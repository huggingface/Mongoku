import * as fs from 'fs'
import * as YAML from 'yaml'
import { Hint } from './Hint'

export namespace Model {

    const MODEL_PATH = './model.yaml';

    const flat = (model: object, root?: string) =>
      Object.entries(model).reduce((acc, [key, value]) => {
        const path = root ? `${root}.${key}` : key;
        return (typeof value === 'object' && !Array.isArray(value))
          ? acc.concat(flat(value, path))
          : acc.concat([[path, value]])
      }, [] as Array<Array<string>>);

    export async function load() {
      try {

        const model = await fs.promises.readFile(MODEL_PATH, 'utf8').catch();
        flat(YAML.parse(model)).forEach(([key, hint]) => Hint.save(key, hint));
        console.log('Module hint loaded correctly')

      } catch (e) {

        if (e.code == 'ENOENT') return false; // skip it, file doesn't exist
        if (e.name == 'YAMLSemanticError') {
          console.log('Cannot convert YAML moder, is the format right?');
          console.log('Skipping module load');
          return false;
        }

        throw e
      }

    }

}
