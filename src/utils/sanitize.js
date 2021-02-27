import path from 'path'

let defaultConfig = {
  input: '',
  builders: [],
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
    let { input, builders, onError, onWarn, onSuccess } = config
    if(typeof input === 'string'){
      result.input = path.normalize(input)
    }
    
    builders = Array.isArray(builders) ? builders : [builders]
    builders = flatten(builders)
    builders = builders.filter(b => (
      b && (b.single || b.aggregate)
    ))
    result.builders = builders

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