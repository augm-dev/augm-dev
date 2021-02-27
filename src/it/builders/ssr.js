import { renderBuilder } from './render'
import { saturationBuilder } from './saturation'
import { styleBuilder } from './style'
const { skypin } = require('skypin')

let defaultOptions = {
  minify: false,
  npm: id => ({
    path: `https://cdn.skypack.dev/${id}`,
    external: true,
  }),
  async optimize(code){
    let promises = []
    let regex = /(https:\/\/cdn\.skypack\.dev\/([\w\-@\/\.,~]+))/gm
    let matches;
    while ((matches = regex.exec(code)) !== null) {
      let [_,url,id] = matches
      promises.push(
        skypin(id, { pin: true, min: true })
          .then((new_url) => code = code.replace(url, new_url))
          .catch((e) => { console.log(e) })
      )
    }
    await Promise.all(promises)
    return code;
  }
}

export function ssrBuilder(options = {}){
  options = Object.assign(defaultOptions, options)
  let style = styleBuilder(options)
  let saturation = saturationBuilder(options)
  let render = renderBuilder(options)

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