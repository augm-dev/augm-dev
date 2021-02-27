let { build } = require('esbuild')
import path from 'path'

export async function compile(code,{
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
        resolveDir: path.dirname(alias)
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