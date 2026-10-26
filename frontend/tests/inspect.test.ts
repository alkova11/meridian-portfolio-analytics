import {describe,it,expect} from 'vitest';
import {nearestIndex,tooltipLeft} from '../src/inspect';
describe('chart inspection',()=>{
 it('selects nearest date and clamps boundaries',()=>{expect(nearestIndex(-20,0,100,253)).toBe(0);expect(nearestIndex(50,0,100,253)).toBe(126);expect(nearestIndex(110,0,100,253)).toBe(252);});
 it('keeps tooltip within chart',()=>{expect(tooltipLeft(490,500)).toBe(318);expect(tooltipLeft(-30,500)).toBe(0);});
});
