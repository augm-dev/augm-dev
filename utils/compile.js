let { build } = require('esbuild')
import path from 'path'
import fs from 'fs'

async function compile_esbuild(code,{
  alias, // abs_path for '@' alias
  local, // resolver for local imports
  npm, // resolver for npm imports
  minify, // boolean flag,
  optimize // async optimizer (skypack pinned url's, for example)
}){
  try{
    let output = await build({
      stdin: Object.assign({
        contents: code,
        loader: 'js',
      }, alias ? {
        // sourcefile: source,
        resolveDir: path.dirname(alias)
      } : {}),
      format: 'esm',
      write: false,
      bundle: true,
      minify,
      plugins: [
        {
          name: 'augm-dev-compile',
          setup(build){
            // Alias @ to actual source
            if(alias){
              build.onResolve({ filter: /^@$/ }, args => {
                return { path: alias, external: false }
              })
            }
            // HTTP imports
            build.onResolve({ filter: /^(https?:\/\/|\/\/)/ }, args => {
              return {
                path: args.path,
                external: true
              }
            })

            // Local imports
            build.onResolve({ filter: /^\./ }, args => {
              if(local){
                return local(args.path)
              }
              return { path: args.path, external: false }
            })
            // NPM imports
            build.onResolve({ filter: /^[\w]+/ }, args => {
              if(npm){
                return npm(args.path)
              }
              return { path: args.path, external: false }
            })
          }
        }
      ]
    })
    if(output && output.outputFiles){
      let res = output.outputFiles[0]
      if(res && res.text){
        return res.text
      }
    }
  } catch(e){
    console.log(e)
  }
  return "";
}



const rollupStream = require('@rollup/stream');
const virtual = require('@rollup/plugin-virtual');

async function compile_rollup(code, { npm, local, alias, minify }={}){
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
        virtual(Object.assign({entry: code}, alias ? { '@': fs.readFileSync(alias,'utf8') } : {} )),
        rollup_resolve_plugin({ local, npm })
      ]
    })
    let bundle = ''
    stream.on('data', data=>(bundle = bundle+data))
    stream.on('end', () => res(bundle))
  })
  return unminified;
}

function rollup_resolve_plugin({ local, npm } = {}){
  return {
    async resolveId(dep){
      if(dep.startsWith('.')){
        if(local){
          let resolution = await local(dep)
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
          let resolution = await npm(dep)
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


export let compile = compile_rollup