'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var path = require('path');
require('fs');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefaultLegacy(path);

require('esbuild');



require('@rollup/stream');
require('@rollup/plugin-virtual');

let defaultConfig = {
  input: '/src',
  output: '/dist',
  builds: [],
  onWarn: ()=>{},
  onError: ()=>{},
  onWarn: ()=>{}
};

function sanitize(config={}){
  let result = {};
  if(typeof config === 'object'){
    let { input, output, builds, onError, onWarn, onSuccess } = config;
    if(typeof input === 'string'){
      result.input = path__default['default'].normalize(input);
    }
    if(typeof output === 'string'){
      result.output = path__default['default'].normalize(output);
    }
    if(Array.isArray(builds)){
      builds = builds.filter(b => (
        b && (b.single || b.aggregate)
      ));
      result.builds = builds;
    }
    if(typeof onError === 'function'){
      result.onError = onError;
    }
    if(typeof onWarn === 'function'){
      result.onWarn = onWarn;
    }
    if(typeof onSuccess === 'function'){
      result.onSuccess = onSuccess;
    }
  }
  return {...defaultConfig, ...result};
}

async function resolveObj(obj={}){
  let promises = [];
  let keys = [];
  for(let k in obj){
    keys.push(k);
    promises.push(obj[k]);
  }
  let values = await Promise.all(promises);
  return values.reduce((o,v,i) => Object.assign(o, { [keys[i]]: v }), {})
}

function mergeObj(arr=[]){
  return Object.assign.apply(null, [{}, ...arr])
}

function builder(config){
  let { input, output, builds, onWarn, onSuccess, onError } = sanitize(config);


  let singles = [];
  let aggregates = {};
  builds.forEach(({ single, aggregate }) => {
    if(single && typeof single === 'function'){
      singles.push(single);
    }
    if(aggregate && typeof aggregate === 'object'){
      Object.assign(aggregates, aggregate);
    }
  });

  function file_info(x){
    let info = {};
    if(typeof x === 'string'){
      info = {
        p: x,
        contents: fs.readFileSync(x),
        module: fs.readFileSync(x)
      };
    } else {
      info = x;
    }
    info.id = path__default['default'].normalize(info.p.replace(process.cwd(),'').replace(input, ''));
    info.id = info.id.substr(0,info.id.length - 3);
    return info
  }


  return async function(changed, total){
    // create single object to hold all single build fns for each target
    let promisedObj = {};
    changed = changed.map(file_info);
    total = total.map(file_info);
    
    changed.forEach(file_info => {
      let singleObj = mergeObj(singles.map(f => f(file_info.id)));
      for(let k in singleObj){
        promisedObj[k] = singleObj[k](file_info);
      }
    });
    for(let k in aggregates){
      promisedObj[k] = aggregates[k](total);
    }
    let result = await resolveObj(promisedObj);
    let out = {};
    for(let k in result){
      out[path__default['default'].join(process.cwd(), output, k)] = result[k];
    }
    return out;
  }
}

let { build } = require('esbuild');

async function compile$1(code,{
  alias, // abs_path for '@' alias
  local, // resolver for local imports
  npm, // resolver for npm imports
  minify, // boolean flag
  optimize, // async optimizer (skypack pinned url's, for example),
  bundle = true
}){
  try{
    let output = await build({
      stdin: Object.assign({
        contents: code,
        loader: 'js',
      }, alias ? {
        // sourcefile: source,
        resolveDir: path__default['default'].dirname(alias)
      } : {}),
      format: 'esm',
      write: false,
      bundle,
      minify,
      plugins: [
        {
          name: 'augm-dev-compile',
          setup(build){
            // Alias @ to actual source
            if(alias){
              build.onResolve({ filter: /^@$/ }, args => {
                return { path: alias, external: false }
              });
            }
            // HTTP imports
            build.onResolve({ filter: /^(https?:\/\/|\/\/)/ }, args => {
              return {
                path: args.path,
                external: true
              }
            });

            // Local imports
            build.onResolve({ filter: /^\./ }, args => {
              if(local){
                return local(args.path)
              }
              return { path: args.path, external: false }
            });
            // NPM imports
            build.onResolve({ filter: /^[\w]+/ }, args => {
              if(npm){
                return npm(args.path)
              }
              return { path: args.path, external: false }
            });
          }
        }
      ]
    });
    if(output && output.outputFiles){
      let res = output.outputFiles[0];
      if(res && res.text){
        return res.text
      }
    }
  } catch(e){
    console.log(e);
  }
  return "";
}

const rollupStream = require('@rollup/stream');
const virtual = require('@rollup/plugin-virtual');
const fs$1 = require('fs');

async function compile(code, { npm, local, alias, minify, optimize }={}){
  let unminified = await new Promise((res, rej) => {
    const stream = rollupStream({
      input: 'entry',
      output: { format: 'esm' },
      cache: false,
      onwarn(){},
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false
      },
      plugins: [
        virtual(Object.assign({entry: code}, alias ? { '@': fs$1.readFileSync(alias,'utf8') } : {} )),
        rollup_resolve_plugin({ local, npm })
      ]
    });
    let bundle = '';
    stream.on('data', data=>(bundle = bundle+data));
    stream.on('end', () => res(bundle));
  });
  let optimized = optimize ? await optimize(unminified) : unminified;
  let minified = minify ? await minify_esbuild(optimized) : optimized;
  return minified;
}

function rollup_resolve_plugin({ local, npm } = {}){
  return {
    async resolveId(dep){
      if(dep.startsWith('.')){
        if(local){
          let resolution = await local(dep);
          return {
            id: resolution.path,
            external: resolution.external
          }
        } else {
          return {
            id: dep,
            external: false
          }
        }
      } else {
        if(npm){
          let resolution = await npm(dep);
          return {
            id: resolution.path,
            external: resolution.external
          }
        } else {
          return {
            id: dep,
            external: false
          }
        }
      }
    }
  }
}

async function minify_esbuild(code){
  let res = compile$1(code, {
    local(id){
      return { path: id, external: true }
    },
    minify: true,
    bundle: false
  });
  return res;
}

function idToMaxDepth$1(id = '/Icons/Github'){
  let numSlashes = id.split('/').length - 1;
  if(numSlashes > 1 ){
    return '../'.repeat(numSlashes-1)
  }
  return './'
}

function deeper$1(p){
  if(p.startsWith('./')){
    return '.'+p
  } else if (p.startsWith('../')){
    return '../'+p
  }
}


function renderBuilder({ npm, minify, optimize }){

  function compileComponent(src){
    return function({ p, module, id }){
      if(module.default && typeof module.default === 'function'){
        return compile(src, {
          alias: p,
          minify,
          npm,
          optimize,
          local(dep){
            let new_path = dep.startsWith(idToMaxDepth$1(id)) ? dep + '/render.js' : dep;
            return { path: deeper$1(new_path), external: true }
          }
        })
      }
    }
  }

  return {
    single: (id) => ({
      [id+'/render.js']: compileComponent(`
        export { default } from '@';
      `),
      [id+'/node.js']: compileComponent(`
        import { html } from 'augm-it';
        import { default as it } from '@';
        export default ()=>html.node\`\${it.apply(null,arguments)}\`;
      `)
    })
  }
}

function idToMaxDepth(id = '/Icons/Github'){
  let numSlashes = id.split('/').length - 1;
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

function saturationBuilder({ minify, npm, optimize }){
  return {
    single: (id) => ({
      [id+'/handlers.js']: ({ module, p, id }) => {
        let handlerExports = Object.keys(module).filter(e => e!=='default' && e!=='style');
        if(handlerExports.length > 0){
          return compile(`
            export { ${ handlerExports.join(',') } } from '@';
          `, {
            alias: p,
            minify,
            npm,
            optimize,
            local(dep){
              let new_path = dep.startsWith(idToMaxDepth(id)) ? dep + '/handlers.js' : dep;
              return { path: deeper(new_path), external: true }
            }
          })
        }
        return `export let handlers = null;`
      }
    }),
    aggregate: {
      'saturation.js': function(targets){
        let imports_strings = [];
        targets.forEach(({ module, contents, id }) => {
          if(module.handlers && typeof module.handlers === 'object'){
            for(let handle in module.handlers){
              imports_strings.push(`"${handle}": () => import(".${id}/handlers.js")`);
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

let csso = require('csso');

function minCSS(src){
  return csso.minify(src).css
}

function getModuleStyle(module, throwErrors = false){
  if(module){
    let { style } = module;
    if(style){
      let t = typeof style;
      if(t === 'function'){
        let output = style();
        if(output && typeof output.toString === 'function'){
          output = output.toString();
        }
        if(typeof output === 'string'){
          return output
        } else if(throwErrors) {
          this.error(`Style export must be a function that returns a string. Returned ${typeof output} instead.`);
        }
      } else if(throwErrors) {
        this.error(`Style export must be a function that returns a string`);
      }
    }
    return ""
  }
}

function styleBuilder({ minify }){
  return {
    single: (id) => ({
      [`${id}/style.css`]: async function({ module }){
        let styles = getModuleStyle.call(this, module, true);
        return minify ? minCSS(styles) : styles
      }
    }),
    aggregate: {
      'styles.css': async function(targets){
        let styles = "";
        targets.forEach(({ module }) => {
          styles += getModuleStyle.call(this, module);
        });
        return minify ? minCSS(styles) : styles
      }
    }
  }
}

const { skypin } = require('skypin');

let defaultOptions = {
  minify: false,
  npm: id => ({
    path: `https://cdn.skypack.dev/${id}`,
    external: true,
  }),
  async optimize(code){
    let promises = [];
    let regex = /(https:\/\/cdn\.skypack\.dev\/([\w\-@\/\.,~]+))/gm;
    let matches;
    while ((matches = regex.exec(code)) !== null) {
      let [_,url,id] = matches;
      promises.push(
        skypin(id, { pin: true, min: true })
          .then((new_url) => code = code.replace(url, new_url))
          .catch((e) => { console.log(e); })
      );
    }
    await Promise.all(promises);
    return code;
  }
};

function ssrBuilder(options = {}){
  options = Object.assign(defaultOptions, options);
  let style = styleBuilder(options);
  let saturation = saturationBuilder(options);
  let render = renderBuilder(options);

  return {
    single: (id) => Object.assign(
      style.single(id),
      saturation.single(id),
      render.single(id),
      {
        [id+'/index.js']:() => `export { default } from './render.js'; export * from './handlers.js';` 
      }
    ),
    aggregate: Object.assign(
      style.aggregate,
      saturation.aggregate,
      render.aggregate
    )
  }
}

exports.builder = builder;
exports.compile = compile;
exports.renderBuilder = renderBuilder;
exports.saturationBuilder = saturationBuilder;
exports.ssrBuilder = ssrBuilder;
exports.styleBuilder = styleBuilder;
