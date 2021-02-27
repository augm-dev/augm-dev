import { sanitize } from '../utils'
import { mergeObj, resolveObj } from '../utils'
import path from 'path'
import { fstat } from 'fs'

export function builder(config){
  let { input, output, builds, onWarn, onSuccess, onError } = sanitize(config)


  function getId({ abs_path }){
    // remove cwd
    let rel = path.normalize(abs_path.replace(process.cwd(), ''))
    // remove input dir
    let id = path.normalize(rel.replace(input, ''))
    // remove js extension
    return id.substr(0,id.length-3)
  }

  let printer = {
    warn(){
      onWarn.apply(null, arguments)
    },
    error(){
      onError.apply(null, arguments)
    },
    success(){
      onSuccess.apply(null, arguments)
    }
  }


  let singles = []
  let aggregates = {}
  builds.forEach(({ single, aggregate }) => {
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
      info = {
        p: x,
        contents: fs.readFileSync(x),
        module: fs.readFileSync(x)
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
    
    changed.forEach(file_info => {
      let singleObj = mergeObj(singles.map(f => f(file_info.id)))
      for(let k in singleObj){
        promisedObj[k] = singleObj[k](file_info)
      }
    })
    for(let k in aggregates){
      promisedObj[k] = aggregates[k](total)
    }
    let result = await resolveObj(promisedObj)
    let out = {}
    for(let k in result){
      out[path.join(process.cwd(), output, k)] = result[k]
    }
    return out;
  }
}