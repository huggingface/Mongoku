import { parseScript } from "esprima";
import type { Expression, Node } from "estree";

function buildObject(node: Node | Expression): unknown {
	switch (node.type) {
		case "ObjectExpression": {
			const obj: Record<string, unknown> = {};
			for (const prop of node.properties) {
				let name;
				if (prop.type === "SpreadElement") {
					throw new Error(`Expected "Property" but received: ${prop.type}`);
				}
				if (prop.key.type === "Identifier") {
					name = prop.key.name;
				} else if (prop.key.type === "Literal") {
					if (
						prop.key.value instanceof RegExp ||
						typeof prop.key.value === "bigint" ||
						prop.key.value === false ||
						prop.key.value === null ||
						prop.key.value === true ||
						prop.key.value === undefined
					) {
						throw new Error(`Expected "Identifier" for object key but received: ${prop.key.type}`);
					}
					name = prop.key.value;
				} else {
					throw new Error(`Expected "Identifier" but received: ${prop.key.type}`);
				}

				obj[name] = buildObject(prop.value);
			}
			return obj;
		}

		case "ArrayExpression": {
			const obj: unknown[] = [];
			for (const prop of node.elements) {
				if (prop === null) {
					throw new Error(`Expected "Expression" but received: ${prop}`);
				}
				obj.push(buildObject(prop));
			}
			return obj;
		}

		case "Literal": {
			if (node.value instanceof RegExp) {
				return {
					$type: "RegExp",
					$value: {
						$pattern: node.value.source,
						$flags: node.value.flags,
					},
				};
			}

			return node.value;
		}

		case "UnaryExpression": {
			if (node.operator === "-" && node.argument.type === "Literal" && typeof node.argument.value === "number") {
				return -node.argument.value;
			}
			// const arg = buildObject(node.argument);
			// const exp = node.prefix ? `${node.operator}${arg}` : `${arg}${node.operator}`;

			// return eval(exp);
			throw new Error(`${node.type} are not authorized`);
		}

		case "NewExpression":
		case "CallExpression": {
			const authorizedCalls = ["ObjectId", "Date", "RegExp"];
			const callee = node.callee.type === "Identifier" ? node.callee.name : null;
			if (callee && authorizedCalls.includes(callee)) {
				if (callee === "RegExp") {
					const [pattern, flags] = node.arguments.map((arg) => buildObject(arg));
					return {
						$type: "RegExp",
						$value: {
							$pattern: pattern,
							$flags: flags,
						},
					};
				}

				return {
					$type: callee,
					$value: buildObject(node.arguments[0]),
				};
			} else {
				throw new Error(`Unknown ${node.type}: ${callee}`);
			}
		}

		case "Identifier": {
			if (node.name === "undefined") {
				return undefined;
			}
			throw `Unknown identifier: ${node.name}`;
		}

		default:
			throw new Error(`Sorry but ${node.type} are not authorized`);
	}
}

export function parseJSON(text: string): unknown {
	const tree = parseScript(`var __JSON__ = ${text};`, {
		tolerant: true,
	});

	const varDeclaration = tree.body[0];
	if (varDeclaration.type !== "VariableDeclaration") {
		throw new Error("Expected VariableDeclaration but received: " + varDeclaration.type);
	}

	const objExpression = varDeclaration.declarations[0].init;
	if (objExpression?.type !== "ObjectExpression") {
		throw new Error("Expected ObjectExpression but received: " + objExpression?.type);
	}

	return buildObject(objExpression);
}
