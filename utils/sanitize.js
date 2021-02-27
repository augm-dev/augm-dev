import path from 'path'

let defaultConfig = {
  input: '/src',
  output: '/dist',
  builds: [],
  onWarn: ()=>{},
  onError: ()=>{},
  onWarn: ()=>{}
}

export function sanitize(config={}){
  let result = {}
  if(typeof config === 'object'){
    let { input, output, builds, onError, onWarn, onSuccess } = config
    if(typeof input === 'string'){
      result.input = path.normalize(input)
    }
    if(typeof output === 'string'){
      result.output = path.normalize(output)
    }
    if(Array.isArray(builds)){
      builds = builds.filter(b => (
        b && (b.single || b.aggregate)
      ))
      result.builds = builds
    }
    if(typeof onError === 'function'){
      result.onError = onError
    }
    if(typeof onWarn === 'function'){
      result.onWarn = onWarn
    }
    if(typeof onSuccess === 'function'){
      result.onSuccess = onSuccess
    }
  }
  return {...defaultConfig, ...result};
}