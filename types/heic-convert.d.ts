declare module "heic-convert" {
  const convert: (input: {
    buffer: Buffer | Uint8Array;
    format: "JPEG" | "PNG";
    quality?: number;
  }) => Promise<ArrayBuffer | Uint8Array | Buffer>;
  export default convert;
}
