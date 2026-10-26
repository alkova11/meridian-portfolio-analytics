export function nearestIndex(clientX:number,left:number,width:number,length:number){
  return Math.max(0,Math.min(length-1,Math.round((clientX-left)/width*(length-1))));
}
export function tooltipLeft(x:number,width:number){return Math.max(0,Math.min(width-182,x+12));}
