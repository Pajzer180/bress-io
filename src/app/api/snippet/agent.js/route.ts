import { NextRequest, NextResponse } from 'next/server';

const AGENT_JS = `(function(){
  try{
    var s=document.currentScript;
    if(!s){console.warn("[Bress agent] no currentScript");return;}
    var token=new URL(s.src).searchParams.get("token");
    if(!token){console.warn("[Bress agent] no token in src");return;}
    var origin=new URL(s.src).origin;
    console.log("[Bress agent] loaded, origin:",origin,"token:",token.slice(0,8)+"…");

    function sendBeacon(){
      try{
        var payload={
          token:token,
          url:location.href,
          hostname:location.hostname,
          title:document.title,
          userAgent:navigator.userAgent,
          vw:window.innerWidth,
          vh:window.innerHeight,
          ts:Date.now()
        };
        console.log("[Bress agent] sending beacon",payload.hostname);
        fetch(origin+"/api/snippet/beacon",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(payload),
          keepalive:true
        }).then(function(r){
          console.log("[Bress agent] beacon response:",r.status);
        }).catch(function(e){
          console.error("[Bress agent] beacon error:",e);
        });
      }catch(e){console.error("[Bress agent] send error:",e);}
    }
    if(document.readyState==="complete"){sendBeacon();}
    else{window.addEventListener("load",sendBeacon);}
  }catch(e){console.error("[Bress agent] init error:",e);}
})();`;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return new NextResponse('// missing token', {
      status: 400,
      headers: { 'Content-Type': 'application/javascript' },
    });
  }

  return new NextResponse(AGENT_JS, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
