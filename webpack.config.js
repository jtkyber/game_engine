const path = require('path');

const dev = {
	mode: 'development',
	devtool: 'inline-source-map',
};

module.exports = {
	mode: 'development',
	context: __dirname,
	entry: './src/index.ts',
	output: {
		filename: 'main.js',
		path: path.resolve(__dirname, 'dist'),
		publicPath: '/dist/',
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: {
					loader: 'ts-loader',
				},
			},
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: ['@babel/preset-env'],
					},
				},
			},
			{
				test: /\.wgsl$/,
				use: {
					loader: 'ts-shader-loader',
				},
			},
		],
	},
	resolve: {
		extensions: ['.ts', '.js'],
	},
};
