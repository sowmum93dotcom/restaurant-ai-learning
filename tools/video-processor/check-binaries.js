'use strict';
// Fail the opted-in Preview install instead of deploying an image-only pipeline
// when a package manager omits the FFmpeg download/install script.
if(process.env.VERCEL_ENV==='preview'&&process.env.DEMEOS_VIDEO_PROCESSING_PROVIDER==='ffmpeg'){
 const fs=require('node:fs'),{execFileSync}=require('node:child_process');
 for(const binary of [require('ffmpeg-static'),require.resolve('@ffprobe-installer/linux-x64/ffprobe')]){
  fs.accessSync(binary,fs.constants.X_OK);
  const version=execFileSync(binary,['-version'],{timeout:5000,encoding:'utf8',maxBuffer:65536}).split('\n')[0];
  console.log('Preview video executable verified: '+version);
 }
}
