import path from 'path'

let defaultConfig = {
  input: '',
  builds: [],
  onWarn: ()=>{},
  onError: ()=>{},
  onWarn: ()=>{}
}

function flatten(arr, d = Infinity) {
  return d > 0 ? arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatDeep(val, d - 1) : val), [])
               : arr.slice();
};

export function sanitize(config={}){
  let result = {}
  if(typeof config === 'object'){
    let { input, builds, onError, onWarn, onSuccess } = config
    if(typeof input === 'string'){
      result.input = path.normalize(input)
    }

    builds = Array.isArray(builds) ? builds : [builds]
    builds = flatten(builds)
    builds = builds.filter(b => (
      b && (b.single || b.aggregate)
    ))
    result.builds = builds

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