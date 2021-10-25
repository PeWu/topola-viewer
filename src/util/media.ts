import {createMedia} from '@artsy/fresnel';

/** Defines the breakpoints at which to show different UI variants.*/
const AppMedia = createMedia({
  breakpoints: {
    small: 320,
    large: 768,
  },
});
export const mediaStyles = AppMedia.createMediaStyle();
export const {Media, MediaContextProvider} = AppMedia;
