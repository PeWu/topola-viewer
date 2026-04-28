declare module '*.jpg';
declare module '*.png';
declare module '*?raw' {
  const content: string;
  export default content;
}

