// Pure depth ordering and picking for the 3D map. `order` holds body indices
// (0..n-1 planets, n = the sun) far -> near; it is re-sorted in place each
// frame (insertion sort: the order barely changes between frames, so ~O(n)).
export function sortFarToNear(order: Int32Array, depth: ArrayLike<number>): void {
  for (let i = 1; i < order.length; i++) {
    const v = order[i], dv = depth[v];
    let j = i - 1;
    while (j >= 0 && depth[order[j]] < dv) { order[j + 1] = order[j]; j--; }
    order[j + 1] = v;
  }
}

/** Index of the NEAREST body whose disc (+slop) contains (x,y), else -1.
 *  Bodies are given by parallel center/radius/depth arrays. */
export function pickNearest(x: number, y: number, cx: ArrayLike<number>, cy: ArrayLike<number>, rad: ArrayLike<number>, depth: ArrayLike<number>, slop: number): number {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < cx.length; i++) {
    const dx = cx[i] - x, dy = cy[i] - y, r = rad[i] + slop;
    if (dx * dx + dy * dy <= r * r && depth[i] < bestD) { best = i; bestD = depth[i]; }
  }
  return best;
}
