import {queryOptions} from '@tanstack/react-query';
import {getHub} from './benefits.functions';
export const hubQuery=queryOptions({queryKey:['beni-hub'],queryFn:()=>getHub()});
