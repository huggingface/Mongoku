import { Injectable } from '@angular/core';
import { parseScript } from 'esprima';
import { Expression, Pattern, SpreadElement, Node } from 'estree';
import { NotificationsService } from './notifications.service';

// Use the Type definition from 'estree' for development but
// must use the `any` for `ng build --prod` for some reason
// type EsTreeNode = Expression | Pattern | SpreadElement;
type EsTreeNode = any;

@Injectable()
export class JsonParserService {

  constructor(private notifService: NotificationsService) { }

  private reportError(message: string) {
    this.notifService.notifyError(message);
  }

  private buildObject(node: EsTreeNode) {
    switch (node.type) {
      case 'ObjectExpression': {
        const obj: any = {};
        for (const prop of node.properties) {
          let name;
          if (prop.key.type === "Identifier") {
            name = prop.key.name;
          } else if (prop.key.type === "Literal") {
            name = prop.key.value;
          } else {
            this.reportError(`Expected "Identifier" but received: ${prop.key.type}`);
            return null;
          }

          obj[name] = this.buildObject(prop.value);
        }
        return obj;
      }

      case 'ArrayExpression': {
        const obj: any[] = [];
        for (const prop of node.elements) {
          obj.push(this.buildObject(prop));
        }
        return obj;
      }

      case 'Literal': {
        if (node.value instanceof RegExp) {
          return {
            $type: "RegExp",
            $value: {
              $pattern: node.value.source,
              $flags:   node.value.flags
            }
          }
        }

        return node.value;
      }

      case 'UnaryExpression': {
        let arg = this.buildObject(node.argument);
        let exp = node.prefix
          ? `${node.operator}${arg}`
          : `${arg}${node.operator}`;

        return eval(exp);
      }

      case 'NewExpression':
      case 'CallExpression': {
        const authorizedCalls = [ 'ObjectId', 'Date', 'RegExp', "Binary" ];
        const callee = node.callee.type === 'Identifier'
          ? node.callee.name
          : null;
        if (callee && authorizedCalls.includes(callee)) {
          if (callee === 'RegExp') {
            const [pattern, flags] = node.arguments.map(this.buildObject.bind(this));
            return {
              $type:  'RegExp',
              $value: {
                $pattern: pattern,
                $flags:   flags
              }
            }
          }
          if (callee === 'Binary') {
            const [sub_type, data] = node.arguments.map(this.buildObject.bind(this));
            return {
              $type:  'Binary',
              $value: {
                $data: data,
                $sub_type:  sub_type
              }
            }
          }

          return {
            $type:  callee,
            $value: this.buildObject(node.arguments[0])
          }
        } else {
          this.reportError(`Unknown ${node.type}: ${callee}`);
          return null;
        }
      }

      default:
        this.reportError(`Sorry but ${node.type} are not authorized`);
        return null;
    }
  }

  parse(text: string, reportError: boolean = true) {
    let tree;
    const error = (err?) => {
      if (reportError) {
        this.reportError(`Error while parsing: ${text}`);
        console.log(err, tree);
        return null;
      }
      throw err;
    }

    try {
      tree = parseScript(`var __JSON__ = ${text};`, {
        tolerant: true
      });

      if (tree.type !== "Program") {
        return error();
      }

      const varDeclaration = tree.body[0];
      if (varDeclaration.type !== 'VariableDeclaration') {
        return error();
      }

      const objExpression = varDeclaration.declarations[0].init;
      if (objExpression.type !== 'ObjectExpression') {
        return error();
      }

      return this.buildObject(objExpression);
    } catch (err) {
      return error(err);
    }
  }
}
