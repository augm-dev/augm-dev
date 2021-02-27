import resolve from '@rollup/plugin-node-resolve';

export default [{
	input: 'src/it/index.js',
	cache: false,
	output: [{
		format: 'cjs',
		file: 'dist/it/index.js',
		sourcemap: false,
	},{
		format: 'esm',
		file: 'dist/it/index.mjs',
		sourcemap: false,
	}],
	plugins: [
		resolve()
	]
},{
	input: 'src/index.js',
	cache: false,
	output: [{
		format: 'cjs',
		file: 'dist/index.js',
		sourcemap: false,
	},{
		format: 'esm',
		file: 'dist/index.mjs',
		sourcemap: false,
	}],
	plugins: [
		resolve()
	]
}]