'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var path = require('path');
require('fs');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefaultLegacy(path);

let defaultConfig = {
  input: '',
  builders: [],
  onWarn: ()=>{},
  onError: ()=>{},
  onWarn: ()=>{}
};

function sanitize(config={}){
  let result = {};
  if(typeof config === 'object'){
    let { input, builders, onError, onWarn, onSuccess } = config;
    if(typeof input === 'string'){
      result.input = path__default['default'].normalize(input);
    }
    if(Array.isArray(builders)){
      builders = builders.filter(b => (
        b && (b.single || b.aggregate)
      ));
      result.builders = builders;
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
  let { input, builders } = sanitize(config);

  let singles = [];
  let aggregates = {};
  builders.forEach(({ single, aggregate }) => {
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
      delete require.cache[x];
      info = {
        p: x,
        contents: fs.readFileSync(x),
        module: require(x)
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
    
    changed.forEach(info => {
      let singleObj = mergeObj(singles.map(f => f(info.id)));
      for(let k in singleObj){
        promisedObj[k] = singleObj[k](info);
      }
    });
    for(let k in aggregates){
      promisedObj[k] = aggregates[k](total);
    }
    let result = await resolveObj(promisedObj);
    let out = {};
    for(let k in result){
      out[path__default['default'].join(process.cwd(), k)] = result[k];
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
const { nodeResolve } = require('@rollup/plugin-node-resolve');
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
        rollup_resolve_plugin({ local, npm }),
        nodeResolve()
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

let FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM, isTTY=true;
if (typeof process !== 'undefined') {
	({ FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM } = process.env);
	isTTY = process.stdout && process.stdout.isTTY;
}

const $ = {
	enabled: !NODE_DISABLE_COLORS && NO_COLOR == null && TERM !== 'dumb' && (
		FORCE_COLOR != null && FORCE_COLOR !== '0' || isTTY
	),

	// modifiers
	reset: init(0, 0),
	bold: init(1, 22),
	dim: init(2, 22),
	italic: init(3, 23),
	underline: init(4, 24),
	inverse: init(7, 27),
	hidden: init(8, 28),
	strikethrough: init(9, 29),

	// colors
	black: init(30, 39),
	red: init(31, 39),
	green: init(32, 39),
	yellow: init(33, 39),
	blue: init(34, 39),
	magenta: init(35, 39),
	cyan: init(36, 39),
	white: init(37, 39),
	gray: init(90, 39),
	grey: init(90, 39),

	// background colors
	bgBlack: init(40, 49),
	bgRed: init(41, 49),
	bgGreen: init(42, 49),
	bgYellow: init(43, 49),
	bgBlue: init(44, 49),
	bgMagenta: init(45, 49),
	bgCyan: init(46, 49),
	bgWhite: init(47, 49)
};

function run(arr, str) {
	let i=0, tmp, beg='', end='';
	for (; i < arr.length; i++) {
		tmp = arr[i];
		beg += tmp.open;
		end += tmp.close;
		if (!!~str.indexOf(tmp.close)) {
			str = str.replace(tmp.rgx, tmp.close + tmp.open);
		}
	}
	return beg + str + end;
}

function chain(has, keys) {
	let ctx = { has, keys };

	ctx.reset = $.reset.bind(ctx);
	ctx.bold = $.bold.bind(ctx);
	ctx.dim = $.dim.bind(ctx);
	ctx.italic = $.italic.bind(ctx);
	ctx.underline = $.underline.bind(ctx);
	ctx.inverse = $.inverse.bind(ctx);
	ctx.hidden = $.hidden.bind(ctx);
	ctx.strikethrough = $.strikethrough.bind(ctx);

	ctx.black = $.black.bind(ctx);
	ctx.red = $.red.bind(ctx);
	ctx.green = $.green.bind(ctx);
	ctx.yellow = $.yellow.bind(ctx);
	ctx.blue = $.blue.bind(ctx);
	ctx.magenta = $.magenta.bind(ctx);
	ctx.cyan = $.cyan.bind(ctx);
	ctx.white = $.white.bind(ctx);
	ctx.gray = $.gray.bind(ctx);
	ctx.grey = $.grey.bind(ctx);

	ctx.bgBlack = $.bgBlack.bind(ctx);
	ctx.bgRed = $.bgRed.bind(ctx);
	ctx.bgGreen = $.bgGreen.bind(ctx);
	ctx.bgYellow = $.bgYellow.bind(ctx);
	ctx.bgBlue = $.bgBlue.bind(ctx);
	ctx.bgMagenta = $.bgMagenta.bind(ctx);
	ctx.bgCyan = $.bgCyan.bind(ctx);
	ctx.bgWhite = $.bgWhite.bind(ctx);

	return ctx;
}

function init(open, close) {
	let blk = {
		open: `\x1b[${open}m`,
		close: `\x1b[${close}m`,
		rgx: new RegExp(`\\x1b\\[${close}m`, 'g')
	};
	return function (txt) {
		if (this !== void 0 && this.has !== void 0) {
			!!~this.has.indexOf(open) || (this.has.push(open),this.keys.push(blk));
			return txt === void 0 ? this : $.enabled ? run(this.keys, txt+'') : txt+'';
		}
		return txt === void 0 ? chain([open], [blk]) : $.enabled ? run([blk], txt+'') : txt+'';
	};
}

let { bold, dim } = $;

let printer = {
  print(message, color="blue"){
    if(!this.silent){
      console.log(`${$[color](`လ`)} ${dim(':')} ${message}`);
    }
  },
  warn(message){
    this.print(message, "yellow");
  },
  error(message, e){
    this.print(message, "red");
  },
  success(message){
    this.print(message, "green");
  },
  info(message){
    this.print(message, "blue");
  },
  benchmarks(arr){
    if(!this.silent){
      if(arr.length){
        console.log(dim("║"));
      }
      arr.forEach(([label, ...facts], i) => {
        console.log(`${i === arr.length - 1 ? dim("╚══") : dim("╟══")} ${label} ${dim("═▷")}  ${facts.join(dim(' -- '))}`);
      });
    }
  },
  silent: false
};

exports.builder = builder;
exports.compile = compile;
exports.printer = printer;
