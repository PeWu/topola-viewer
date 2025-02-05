declare module 'lunr-languages/lunr.*' {
  import lunr from 'lunr';

  function register(l: typeof lunr): void;

  export = register;
}
