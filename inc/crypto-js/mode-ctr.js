(function(e,r){"object"==typeof exports?module.exports=exports=r(require("./core"),require("./cipher-core")):"function"==typeof define&&define.amd?define(["./core","./cipher-core"],r):r(e.CryptoJS)})(this,function(e){return e.mode.CTR=function(){var r=e.lib.BlockCipherMode.extend(),t=r.Encryptor=r.extend({processBlock:function(e,r){var t=this._cipher,i=t.blockSize,n=this._iv,o=this._counter;n&&(o=this._counter=n.slice(0),this._iv=void 0);var c=o.slice(0);t.encryptBlock(c,0),o[i-1]=0|o[i-1]+1;for(var s=0;i>s;s++)e[r+s]^=c[s]}});return r.Decryptor=t,r}(),e.mode.CTR});