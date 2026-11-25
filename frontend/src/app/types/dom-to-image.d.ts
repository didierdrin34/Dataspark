declare module 'dom-to-image' {
  interface Options {
    bgcolor?: string;
    width?: number;
    height?: number;
    style?: Record<string, string>;
    quality?: number;
    imagePlaceholder?: string;
    cacheBust?: boolean;
    filter?: (node: Node) => boolean;
  }

  export function toPng(node: HTMLElement, options?: Options): Promise<string>;
  export function toJpeg(node: HTMLElement, options?: Options): Promise<string>;
  export function toBlob(node: HTMLElement, options?: Options): Promise<Blob>;
  export function toSvg(node: HTMLElement, options?: Options): Promise<string>;
  export function toPixelData(node: HTMLElement, options?: Options): Promise<Uint8ClampedArray>;
}
