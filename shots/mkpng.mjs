import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
// 8x8 RGBA white PNG
const w=8,h=8,bpp=4,stride=w*bpp;
const raw=Buffer.alloc((stride+1)*h);
for(let y=0;y<h;y++){ const o=y*(stride+1); raw[o]=0; for(let x=0;x<stride;x++) raw[o+1+x]=255; }
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const t=Buffer.from(type,"ascii");const crcBuf=Buffer.alloc(4);crcBuf.writeUInt32BE(0);return Buffer.concat([len,t,data]);}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
const sig=Buffer.from([137,80,78,71,13,10,26,10]);
writeFileSync("shots/knowntest.png",Buffer.concat([sig,chunk("IHDR",ihdr),chunk("IDAT",deflateSync(raw)),chunk("IEND",Buffer.alloc(0))]));
