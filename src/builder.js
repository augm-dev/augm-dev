import { sanitize } from '../utils'
import { mergeObj, resolveObj } from '../utils'
import path from 'path'
import { fstat } from 'fs'

export function builder(config){
  let { input, builders } = sanitize(config)

  let singles = []
  let aggregates = {}
  builders.forEach(({ single, aggregate }) => {
    if(single && typeof single === 'function'){
      singles.push(single)
    }
    if(aggregate && typeof aggregate === 'object'){
      Object.assign(aggregates, aggregate)
    }
  });

  function file_info(x){
    let info = {}
    if(typeof x === 'string'){
      delete require.cache[x]
      info = {
        p: x,
        contents: fs.readFileSync(x),
        module: require(x)
      }
    } else {
      info = x
    }
    info.id = path.normalize(info.p.replace(process.cwd(),'').replace(input, ''));
    info.id = info.id.substr(0,info.id.length - 3)
    return info
  }


  return async function(changed, total){
    // create single object to hold all single build fns for each target
    let promisedObj = {}
    changed = changed.map(file_info)
    total = total.map(file_info)
    
    changed.forEach(info => {
      let singleObj = mergeObj(singles.map(f => f(info.id)))
      for(let k in singleObj){
        promisedObj[k] = singleObj[k](info)
      }
    })
    for(let k in aggregates){
      promisedObj[k] = aggregates[k](total)
    }
    let result = await resolveObj(promisedObj)
    let out = {}
    for(let k in result){
      out[path.join(process.cwd(), k)] = result[k]
    }
    return out;
  }
}