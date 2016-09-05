/**
 * Created by Administrator on 2016/9/5.
 */
// 'use strict';

// var _ = require('lodash');

function initWatchVal() {
    
}

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
}

Scope.prototype.$watch = function (watchFn,listenerFn,valueEq) {
    var watcher = {
        watchFn:watchFn,
        listenerFn:listenerFn,
        valueEq:!!valueEq,
        last:initWatchVal
    };
    this.$$watchers.push(watcher);
    this.$$lastDirtyWatch = null;
};

Scope.prototype.$$digestOnce = function () {
    var self = this;
    var newValue,oldValue,dirty;
    // _.forEach(this.$$watchers,function (watcher) {
    //     newValue = watcher.watchFn(self);
    //     oldValue = watcher.last;
    //     console.log(newValue);
    //     if (newValue !== oldValue){
    //         self.$$lastDirtyWatch = watcher;
    //         watcher.last = newValue;
    //         watcher.listenerFn(newValue,
    //             (oldValue === initWatchVal ? newValue : oldValue),
    //             self);
    //         dirty = true;
    //     }
    // });
    this.$$watchers.forEach(function (watcher) {
        newValue = watcher.watchFn(self);
        oldValue = watcher.last;
        // console.log(newValue);
        if (newValue !== oldValue){
            self.$$lastDirtyWatch = watcher;
            watcher.last = newValue;
            watcher.listenerFn(newValue,
                (oldValue === initWatchVal ? newValue : oldValue),
                self);
            dirty = true;
        }else if(self.$$lastDirtyWatch === watcher){
            return false;
        }
    });
    return dirty;
};

Scope.prototype.$digest = function () {
    var ttl = 10;
    var dirty;
    this.$$lastDirtyWatch = null;
    do{
        dirty = this.$$digestOnce();
        if(dirty && !(ttl--)){
            throw "10次了";
        }
    } while(dirty);
};


// function copy(source, destination) {
//     var stackSource = [];
//     var stackDest = [];
//
//     if (destination) {
//         if (isTypedArray(destination) || isArrayBuffer(destination)) {
//             throw ngMinErr('cpta', 'Can\'t copy! TypedArray destination cannot be mutated.');
//         }
//         if (source === destination) {
//             throw ngMinErr('cpi', 'Can\'t copy! Source and destination are identical.');
//         }
//
//         // Empty the destination object
//         if (isArray(destination)) {
//             destination.length = 0;
//         } else {
//             forEach(destination, function(value, key) {
//                 if (key !== '$$hashKey') {
//                     delete destination[key];
//                 }
//             });
//         }
//
//         stackSource.push(source);
//         stackDest.push(destination);
//         return copyRecurse(source, destination);
//     }
//
//     return copyElement(source);
//
//     function copyRecurse(source, destination) {
//         var h = destination.$$hashKey;
//         var key;
//         if (isArray(source)) {
//             for (var i = 0, ii = source.length; i < ii; i++) {
//                 destination.push(copyElement(source[i]));
//             }
//         } else if (isBlankObject(source)) {
//             // createMap() fast path --- Safe to avoid hasOwnProperty check because prototype chain is empty
//             for (key in source) {
//                 destination[key] = copyElement(source[key]);
//             }
//         } else if (source && typeof source.hasOwnProperty === 'function') {
//             // Slow path, which must rely on hasOwnProperty
//             for (key in source) {
//                 if (source.hasOwnProperty(key)) {
//                     destination[key] = copyElement(source[key]);
//                 }
//             }
//         } else {
//             // Slowest path --- hasOwnProperty can't be called as a method
//             for (key in source) {
//                 if (hasOwnProperty.call(source, key)) {
//                     destination[key] = copyElement(source[key]);
//                 }
//             }
//         }
//         setHashKey(destination, h);
//         return destination;
//     }
//
//     function copyElement(source) {
//         // Simple values
//         if (!isObject(source)) {
//             return source;
//         }
//
//         // Already copied values
//         var index = stackSource.indexOf(source);
//         if (index !== -1) {
//             return stackDest[index];
//         }
//
//         if (isWindow(source) || isScope(source)) {
//             throw ngMinErr('cpws',
//                 'Can\'t copy! Making copies of Window or Scope instances is not supported.');
//         }
//
//         var needsRecurse = false;
//         var destination = copyType(source);
//
//         if (destination === undefined) {
//             destination = isArray(source) ? [] : Object.create(getPrototypeOf(source));
//             needsRecurse = true;
//         }
//
//         stackSource.push(source);
//         stackDest.push(destination);
//
//         return needsRecurse
//             ? copyRecurse(source, destination)
//             : destination;
//     }
//
//     function copyType(source) {
//         switch (toString.call(source)) {
//             case '[object Int8Array]':
//             case '[object Int16Array]':
//             case '[object Int32Array]':
//             case '[object Float32Array]':
//             case '[object Float64Array]':
//             case '[object Uint8Array]':
//             case '[object Uint8ClampedArray]':
//             case '[object Uint16Array]':
//             case '[object Uint32Array]':
//                 return new source.constructor(copyElement(source.buffer), source.byteOffset, source.length);
//
//             case '[object ArrayBuffer]':
//                 // Support: IE10
//                 if (!source.slice) {
//                     // If we're in this case we know the environment supports ArrayBuffer
//                     /* eslint-disable no-undef */
//                     var copied = new ArrayBuffer(source.byteLength);
//                     new Uint8Array(copied).set(new Uint8Array(source));
//                     /* eslint-enable */
//                     return copied;
//                 }
//                 return source.slice(0);
//
//             case '[object Boolean]':
//             case '[object Number]':
//             case '[object String]':
//             case '[object Date]':
//                 return new source.constructor(source.valueOf());
//
//             case '[object RegExp]':
//                 var re = new RegExp(source.source, source.toString().match(/[^\/]*$/)[0]);
//                 re.lastIndex = source.lastIndex;
//                 return re;
//
//             case '[object Blob]':
//                 return new source.constructor([source], {type: source.type});
//         }
//
//         if (isFunction(source.cloneNode)) {
//             return source.cloneNode(true);
//         }
//     }
// }
//
// function equals(o1, o2) {
//     if (o1 === o2) return true;
//     if (o1 === null || o2 === null) return false;
//     // eslint-disable-next-line no-self-compare
//     if (o1 !== o1 && o2 !== o2) return true; // NaN === NaN
//     var t1 = typeof o1, t2 = typeof o2, length, key, keySet;
//     if (t1 === t2 && t1 === 'object') {
//         if (isArray(o1)) {
//             if (!isArray(o2)) return false;
//             if ((length = o1.length) === o2.length) {
//                 for (key = 0; key < length; key++) {
//                     if (!equals(o1[key], o2[key])) return false;
//                 }
//                 return true;
//             }
//         } else if (isDate(o1)) {
//             if (!isDate(o2)) return false;
//             return equals(o1.getTime(), o2.getTime());
//         } else if (isRegExp(o1)) {
//             if (!isRegExp(o2)) return false;
//             return o1.toString() === o2.toString();
//         } else {
//             if (isScope(o1) || isScope(o2) || isWindow(o1) || isWindow(o2) ||
//                 isArray(o2) || isDate(o2) || isRegExp(o2)) return false;
//             keySet = createMap();
//             for (key in o1) {
//                 if (key.charAt(0) === '$' || isFunction(o1[key])) continue;
//                 if (!equals(o1[key], o2[key])) return false;
//                 keySet[key] = true;
//             }
//             for (key in o2) {
//                 if (!(key in keySet) &&
//                     key.charAt(0) !== '$' &&
//                     isDefined(o2[key]) &&
//                     !isFunction(o2[key])) return false;
//             }
//             return true;
//         }
//     }
//     return false;
// }