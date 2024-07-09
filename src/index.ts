import App from './control/app';

if (!navigator.gpu) throw new Error('WebGPU not supported on this browser');

const canvas: HTMLCanvasElement = <HTMLCanvasElement>document.getElementById('canvas');

const app = new App(canvas);
app.init().then(app.start);
