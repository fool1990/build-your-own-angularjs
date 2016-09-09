/**
 * Created by Administrator on 2016/9/5.
 */
'use strict';

const _ = require('lodash');

function initWatchVal() {}

class Scope {
	constructor () {
		this.$$watchers = [];
		this.$$lastDirtyWatch = null;
		this.$$asyncQueue = [];
		this.$root = this;
		this.$$phase = null;
		this.$$applyAsyncQueue = [];
		this.$$applyAsyncId = null;
		this.$$postDigestQueue = [];
		this.$$children = [];
	}

	$watch(watchFn,listenerFn,valueEq) {
		const self =this;
		let watcher = {
			watchFn:watchFn,
			listenerFn:listenerFn,
			valueEq:!!valueEq,
			last:initWatchVal
		};
		this.$$watchers.unshift(watcher);
		this.$root.$$lastDirtyWatch = null;
		return () => {
			let index = self.$$watchers.indexOf(watcher);
			if (index >= 0) {
				self.$$watchers.splice(index,1);
				self.$root.$$lastDirtyWatch = null;
			}
		}
	};

	$watchGroup(watchFns,listenerFn) {
		const self = this;
		const newValues = new Array(watchFns.length);
		const oldValues = new Array(watchFns.length);
		let firstRun = true;
		let changeReactionScheduled = false;

		if (watchFns.length === 0) {
			let shouldCall = true;
			self.$evalAsync(() => {
				if (shouldCall) {
					listenerFn(newValues,newValues,self);
				}
			});
			return (() => shouldCall = false);
		}

		const watchGroupListener = () => {
			if (firstRun) {
				firstRun = false;
				listenerFn(newValues,newValues,self);
			} else {
				listenerFn(newValues,oldValues,self);
			}
			changeReactionScheduled = false;
		};

		const destroyFunctions = _.map(watchFns,(watchFn,i) => {
			return self.$watch(watchFn,(newValue,oldValue) => {
				newValues[i] = newValue;
				oldValues[i] = oldValue;
				if (!changeReactionScheduled) {
					changeReactionScheduled = true;
					self.$evalAsync(watchGroupListener);
				}
			});
		});

		return () => {
			_.forEach(destroyFunctions, (destroyFunction) => destroyFunction());
		};
	}

	$$digestOnce() {
		let dirty;
		let continueLoop = true;
		const self = this;

		this.$$everyScope((scope) => {
			let newValue,oldValue;
			_.forEachRight(scope.$$watchers,function (watcher) {
				try {
					if (watcher) {
						newValue = watcher.watchFn(scope);
						oldValue = watcher.last;
						if (!scope.$$areEqual(newValue,oldValue,watcher.valueEq)){
							scope.$root.$$lastDirtyWatch = watcher;
							watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
							watcher.listenerFn(newValue,
								(oldValue === initWatchVal ? newValue : oldValue),
								scope);
							dirty = true;
						}else if(scope.$root.$$lastDirtyWatch === watcher){
							continueLoop = false;
							return false;
						}
					}
				} catch (e) {
					console.error(e);
				}
			});
			return continueLoop;
		});
		return dirty;
	};

	$digest() {
		let ttl = 10;
		let dirty;
		this.$root.$$lastDirtyWatch = null;
		this.$beginPhase("$digest");

		if (this.$root.$$applyAsyncId) {
			clearTimeout(this.$root.$$applyAsyncId);
			this.$$flushApplyAsync();
		}

		do{
			while(this.$$asyncQueue.length){
				try {
					let asyncTask = this.$$asyncQueue.shift();
					asyncTask.scope.$eval(asyncTask.expression);
				} catch (e) {
					console.error(e);
				}
			}
			dirty = this.$$digestOnce();
			if((dirty || this.$$asyncQueue.length) && !(ttl--)){
				this.$clearPhase();
				throw "10次了";
			}
		} while(dirty || this.$$asyncQueue.length);
		this.$clearPhase();

		while (this.$$postDigestQueue.length) {
			try {
				this.$$postDigestQueue.shift()();
			} catch (e) {
				console.error(e);
			}
		}
	};

	$$areEqual(newValue,oldValue,valueEq) {
		if (valueEq) {
			return _.isEqual(newValue,oldValue);
		} else {
			return newValue === oldValue ||
				(typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue));
		}
	};

	$eval(expr,locals) {
		return expr(this,locals);
	};

	$apply(expr) {
		try {
			this.$beginPhase('$apply');
			return this.$eval(expr);
		} finally {
			this.$clearPhase();
			this.$root.$digest();
		}
	};

	$evalAsync(expr) {
		const self = this;
		if (!self.$$phase && !self.$$asyncQueue.length) {
			setTimeout(function () {
				if (self.$$asyncQueue.length){
					self.$root.$digest();
				}
			},0);
		}
		self.$$asyncQueue.push({scope:this,expression:expr});
	};

	$applyAsync(expr) {
		const self = this;
		self.$$applyAsyncQueue.push(function () {
			self.$eval(expr);
		});
		if (self.$root.$$applyAsyncId === null) {
			self.$root.$$applyAsyncId = setTimeout(function () {
				self.$apply(_.bind(self.$$flushApplyAsync,self));
			},0);
		}
	};

	$$postDigest(fn) {
		this.$$postDigestQueue.push(fn);
	};

	$$flushApplyAsync() {
		while (this.$$applyAsyncQueue.length) {
			try {
				this.$$applyAsyncQueue.shift()();
			} catch (e) {
				console.error(e);
			}
		}
		this.$root.$$applyAsyncId = null;
	};

	$beginPhase(phase) {
		if (this.$$phase) {
			throw this.$$phase + 'in progress';
		}
		this.$$phase = phase;
	};

	$clearPhase() {
		this.$$phase = null;
	};

	$new(isolated,parent) {
		let child;
		parent = parent || this;
		if (isolated) {
			child = new Scope();
			child.$root = parent.$root;
			child.$$asyncQueue = parent.$$asyncQueue;
			child.$$postDigestQueue = parent.$$postDigestQueue;
			child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
		} else {
			child = Object.create(this,{$$watchers:{value:[],writable: true, enumerable: true, configurable: true}});
		}
		parent.$$children.push(child);
		child.$$watchers = [];
		child.$$children = [];
		child.$parent = parent;
		return child;
	};

	$$everyScope(fn) {
		if (fn(this)) {
			return this.$$children.every((child) => child.$$everyScope(fn));
		} else {
			return false;
		}
	};

	$destroy() {
		if (this.$parent) {
			const siblings = this.$parent.$$children;
			const indexOfThis = siblings.indexOf(this);
			if (indexOfThis >= 0) {
				siblings.splice(indexOfThis,1);
			}
		}
		this.$$watchers = null;
	};

	$watchCollection(watchFn,listenerFn) {
		let newValue;
		let oldValue;
		let changeCount = 0;
		const internalWatchFn = (scope) => {
			newValue = watchFn(scope);
			// console.log(newValue);
			if (_.isObject(newValue)) {
				if (_.isArray(newValue)) {
					if (!_.isArray(oldValue)) {
						changeCount++;
						oldValue = [];
					}
					if (newValue.length !== oldValue.length) {
						changeCount++;
						oldValue.length = newValue.length;
					}
					_.forEach(newValue,(newItem,i) => {
						let bothNan = _.isNaN(newItem) && _.isNaN(oldValue[i]);
						if (!bothNan && newItem !== oldValue[i]) {
							changeCount++;
							oldValue[i] = newItem;
						}
					});
				}else{

				}
			} else {
				if (!this.$$areEqual(newValue,oldValue,false)) {
					changeCount++;
				}
				oldValue = newValue;
			}

			return changeCount;
		};

		const internalListenerFn = () => {
			listenerFn(newValue,oldValue,this);
		};

		return this.$watch(internalWatchFn,internalListenerFn);
	};
}

const scope = new Scope();
scope.arr = [1,2,NaN];
scope.counter = 0;

scope.$watchCollection(
	(scope) => scope.arr,
	(newValue,oldValue,scope) => {
		scope.counter++;
	}
);

scope.$digest();
console.log(scope.counter,'1');

scope.arr[1] = 20;
scope.$digest();
console.log(scope.counter,'2');

scope.$digest();
console.log(scope.counter,'2');



// function timeout(ms) {
// 	return new Promise((resolve, reject) => {
// 		console.log('aaa');
// 		setTimeout(resolve, ms, 'done');
// 	});
// }
//
// timeout(100).then((value) => {
// 	console.log(value);
// 	console.log('bbb');
// });

// let promise = new Promise((resolve,reject) => {
// 	console.log('new promise');
// 	resolve();
// });
// promise.then(() => console.log('resolved'));
// console.log('hi');

var p1 = new Promise(function (resolve, reject) {
	setTimeout(() => reject(new Error('fail')), 3000)
});

var p2 = new Promise(function (resolve, reject) {
	setTimeout(() => resolve(p1), 1000)
});

p2
	.then(result => console.log(result))
	.catch(error => console.log(error));