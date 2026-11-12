import { crRequest } from './browser';
// Row shapes are validated by the resource-specific server and existing editors.
type Result = { data: any; error: {message:string;code?:string}|null };
type Filter = { column:string; op:string; value:unknown };
class Query implements PromiseLike<Result> {
 private spec: {table:string;action:string;filters:Filter[];values?:unknown;single?:boolean;order?:string;ascending?:boolean;limit?:number};
 constructor(table:string) { this.spec={table,action:'select',filters:[]}; }
 select(_columns?:string) { return this; }
 eq(column:string,value:unknown) { this.spec.filters.push({column,op:'eq',value});return this; }
 in(column:string,value:unknown[]) { this.spec.filters.push({column,op:'in',value});return this; }
 not(column:string,op:string,value:string) { if(op!=='in')throw new Error('Filtro não suportado');this.spec.filters.push({column,op:'not_in',value:value.replace(/[()]/g,'').split(',')});return this; }
 order(column:string,options?:{ascending?:boolean;nullsFirst?:boolean}) {this.spec.order=column;this.spec.ascending=options?.ascending!==false;return this;}
 limit(value:number) {this.spec.limit=value;return this;}
 single(){this.spec.single=true;return this;}
 maybeSingle(){this.spec.single=true;return this;}
 insert(values:unknown){this.spec.action='insert';this.spec.values=values;return this;}
 upsert(values:unknown,_options?:unknown){this.spec.action='upsert';this.spec.values=values;return this;}
 update(values:unknown){this.spec.action='update';this.spec.values=values;return this;}
 delete(){this.spec.action='delete';return this;}
 then<T=Result,U=never>(fulfilled?:((value:Result)=>T|PromiseLike<T>)|null,rejected?:((reason:unknown)=>U|PromiseLike<U>)|null):PromiseLike<T|U> {return crRequest('commerce/query','POST',this.spec).then(fulfilled,rejected);}
}
export function createClient(){return {from:(table:string)=>new Query(table),rpc:(name:string,args:Record<string,unknown>)=>crRequest<any>('commerce/rpc','POST',{name,args})};}
