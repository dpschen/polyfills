/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

import * as utils from './utils.js';
import {shadyDataForNode, ensureShadyDataForNode} from './shady-data.js';
import {patchInsideElementAccessors, patchOutsideElementAccessors} from './patch-instances.js';

function linkNode(node, container, ref_node) {
  patchOutsideElementAccessors(node);
  ref_node = ref_node || null;
  const nodeData = ensureShadyDataForNode(node);
  const containerData = ensureShadyDataForNode(container);
  const ref_nodeData = ref_node ? ensureShadyDataForNode(ref_node) : null;
  // update ref_node.previousSibling <-> node
  nodeData.previousSibling = ref_node ? ref_nodeData.previousSibling :
    container[utils.SHADY_PREFIX + 'lastChild'];
  let psd = shadyDataForNode(nodeData.previousSibling);
  if (psd) {
    psd.nextSibling = node;
  }
  // update node <-> ref_node
  let nsd = shadyDataForNode(nodeData.nextSibling = ref_node);
  if (nsd) {
    nsd.previousSibling = node;
  }
  // update node <-> container
  nodeData.parentNode = container;
  if (ref_node) {
    if (ref_node === containerData.firstChild) {
      containerData.firstChild = node;
    }
  } else {
    containerData.lastChild = node;
    if (!containerData.firstChild) {
      containerData.firstChild = node;
    }
  }
  // remove caching of childNodes
  containerData.childNodes = null;
}

export const recordInsertBefore = (node, container, ref_node) => {
  patchInsideElementAccessors(container);
  const containerData = ensureShadyDataForNode(container);
  if (containerData.firstChild !== undefined) {
    containerData.childNodes = null;
  }
  // handle document fragments
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    let c$ = node[utils.SHADY_PREFIX + 'childNodes'];
    for (let i=0; i < c$.length; i++) {
      linkNode(c$[i], container, ref_node);
    }
    // cleanup logical dom in doc fragment.
    const nodeData = ensureShadyDataForNode(node);
    let resetTo = (nodeData.firstChild !== undefined) ? null : undefined;
    nodeData.firstChild = nodeData.lastChild = resetTo;
    nodeData.childNodes = resetTo;
  } else {
    linkNode(node, container, ref_node);
  }
}

export const recordRemoveChild = (node, container) => {
  const nodeData = ensureShadyDataForNode(node);
  const containerData = ensureShadyDataForNode(container);
  if (node === containerData.firstChild) {
    containerData.firstChild = nodeData.nextSibling;
  }
  if (node === containerData.lastChild) {
    containerData.lastChild = nodeData.previousSibling;
  }
  let p = nodeData.previousSibling;
  let n = nodeData.nextSibling;
  if (p) {
    ensureShadyDataForNode(p).nextSibling = n;
  }
  if (n) {
    ensureShadyDataForNode(n).previousSibling = p;
  }
  // When an element is removed, logical data is no longer tracked.
  // Explicitly set `undefined` here to indicate this. This is disginguished
  // from `null` which is set if info is null.
  nodeData.parentNode = nodeData.previousSibling =
  nodeData.nextSibling = undefined;
  if (containerData.childNodes !== undefined) {
    // remove caching of childNodes
    containerData.childNodes = null;
  }
}

/**
 * @param  {!Node} node
 * @param  {Array<Node>=} nodes
 */
export const recordChildNodes = (node) => {
  const nodeData = ensureShadyDataForNode(node);
  if (nodeData.firstChild === undefined) {
    // remove caching of childNodes
    nodeData.childNodes = null;
    const first = nodeData.firstChild = node[utils.NATIVE_PREFIX + 'firstChild'] || null;
    nodeData.lastChild = node[utils.NATIVE_PREFIX + 'lastChild'] || null;
    patchInsideElementAccessors(node);
    for (let n = first, previous; n; (n = n[utils.NATIVE_PREFIX + 'nextSibling'])) {
      const sd = ensureShadyDataForNode(n);
      sd.parentNode = node;
      sd.nextSibling = n[utils.NATIVE_PREFIX + 'nextSibling'] || null;
      sd.previousSibling = previous || null;
      previous = n;
      patchOutsideElementAccessors(n);
    }
  }
}