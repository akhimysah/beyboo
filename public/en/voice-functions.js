/* Function calls execute once; spoken confirmation follows the actual screen result. */
(() => {
  window.createBeybooToolBridge = ({send,execute,isCurrent,onFollowup}) => {
    const jobs=new Map(),responses=new Map(),completed=new Set();let epoch=0,disposed=false;
    const valid=()=>!disposed&&isCurrent();
    function job(call,responseId) {
      if(jobs.has(call.call_id))return jobs.get(call.call_id);
      const turn=responses.get(responseId)??epoch;
      const pending=Promise.resolve().then(async()=>{
        if(!valid())return;
        let result;
        if(turn!==epoch)result={ok:false,cancelled:true,description:'A new request interrupted this action.'};
        else if(call.name!=='control_beyboo_screen')result={ok:false,description:'Unknown tool.'};
        else {
          try{const args=JSON.parse(call.arguments);result=await execute(args);}
          catch{result={ok:false,description:'Couldn’t complete the action.'};}
        }
        if(valid())send({type:'conversation.item.create',item:{type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)}});
      });
      jobs.set(call.call_id,pending);return pending;
    }
    return {
      interrupt(){epoch++;},
      dispose(){disposed=true;epoch++;jobs.clear();responses.clear();completed.clear();},
      handle(event){
        if(!valid())return;
        if(event.type==='response.created')responses.set(event.response.id,epoch);
        if(event.type==='response.function_call_arguments.done')job(event,event.response_id);
        if(event.type==='response.done'){
          const response=event.response,turn=responses.get(response.id)??epoch;
          if(completed.has(response.id))return;completed.add(response.id);
          const calls=(response.output||[]).filter(item=>item.type==='function_call');
          if(!calls.length)return;
          Promise.all(calls.map(call=>job(call,response.id))).then(()=>{
            if(!valid()||turn!==epoch||response.status!=='completed')return;
            onFollowup();send({type:'response.create'});
          });
        }
      }
    };
  };
})();
