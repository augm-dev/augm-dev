import { compile } from '../../compile'

/*! (c) Andrea Giammarchi - ISC */
// Adapted from https://github.com/WebReflection/stringified-handler

const stringifyObject = (handler) => (
  '{' + Object.keys(handler).map(key => {
    const {get, set, value} = Object.getOwnPropertyDescriptor(handler, key);
    if (get && set)
      key = get + ',' + set;
    else if (get)
      key = '' + get;
    else if (set)
      key = '' + set;
    else
      key = JSON.stringify(key) + ':' + parseValue(value, key);
    return key;
  }).join(',') + '}'
);

const parseValue = (value, key) => {
  const type = typeof value;
  if (type === 'function')
    return value.toString().replace(
      new RegExp('^(\\*|async )?\\s*' + key + '[^(]*?\\('),
      (_, $1) => $1 === '*' ? 'function* (' : (($1 || '') + 'function (')
    );
  if (type === 'object' && value)
    return Array.isArray(value) ?
            parseArray(value) :
            stringifyObject(value);
  return JSON.stringify(value);
};

const parseArray = array => ('[' + array.map(parseValue).join(',') + ']');

function idToMaxDepth(id = '/Icons/Github'){
  let numSlashes = id.split('/').length - 1
  if(numSlashes > 1 ){
    return '../'.repeat(numSlashes-1)
  }
  return './'
}

function deeper(p){
  if(p.startsWith('./')){
    return '.'+p
  } else if (p.startsWith('../')){
    return '../'+p
  }
}

export function saturationBuilder({ minify, npm, optimize }){
  return {
    single: (id) => ({
      [id+'/handlers.js']: ({ module, p, id }) => {
        let handlerExports = Object.keys(module).filter(e => e!=='default' && e!=='style')
        if(handlerExports.length > 0){
          return compile(`
            export { ${ handlerExports.join(',') } } from '@';
          `, {
            alias: p,
            minify,
            npm,
            optimize,
            local(dep){
              let new_path = dep.startsWith(idToMaxDepth(id)) ? dep + '/handlers.js' : dep
              return { path: deeper(new_path), external: true }
            }
          })
        }
        return `export let handlers = null;`
      }
    }),
    aggregate: {
      'saturation.js': function(targets){
        let manifest = {}
        let imports_strings = []
        targets.forEach(({ module, contents, id }) => {
          if(module.handlers && typeof module.handlers === 'object'){
            for(let handle in module.handlers){
              imports_strings.push(`"${handle}": () => import(".${id}/handlers.js")`)
            }
          }
        });

        return compile(`
          import { saturateAsync } from 'augm-it/saturation';
          saturateAsync({
            ${imports_strings.join(',\n')}
          });
        `, {
          minify,
          npm,
          optimize,
          local(id){
            return { path: id, external: true }
          }
        })
      }
    }
  }
}
