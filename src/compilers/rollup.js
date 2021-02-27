import { compile as esbuild_compile } from './esbuild'

const rollupStream = require('@rollup/stream');
const virtual = require('@rollup/plugin-virtual');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const fs = require('fs')

export async function compile(code, { npm, local, alias, minify, optimize }={}){
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
        rollup_resolve_plugin({ local, npm }),
        nodeResolve()
      ]
    })
    let bundle = ''
    stream.on('data', data=>(bundle = bundle+data))
    stream.on('end', () => res(bundle))
  })
  let optimized = optimize ? await optimize(unminified) : unminified
  let minified = minify ? await minify_esbuild(optimized) : optimized
  return minified;
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
        }
      }
    }
  }
}

async function minify_esbuild(code){
  let res = esbuild_compile(code, {
    local(id){
      return { path: id, external: true }
    },
    minify: true,
    bundle: false
  })
  return res;
}