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
		this.$$lastDirtyWatch = null;
		return () => {
			let index = self.$$watchers.indexOf(watcher);
			if (index >= 0) {
				self.$$watchers.splice(index,1);
				self.$$lastDirtyWatch = null;
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
							self.$$lastDirtyWatch = watcher;
							watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
							watcher.listenerFn(newValue,
								(oldValue === initWatchVal ? newValue : oldValue),
								scope);
							dirty = true;
						}else if(self.$$lastDirtyWatch === watcher){
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
		this.$$lastDirtyWatch = null;
		this.$beginPhase("$digest");

		if (this.$$applyAsyncId) {
			clearTimeout(this.$$applyAsyncId);
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
			this.$digest();
		}
	};

	$evalAsync(expr) {
		const self = this;
		if (!self.$$phase && !self.$$asyncQueue.length) {
			setTimeout(function () {
				if (self.$$asyncQueue.length){
					self.$digest();
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
		if (self.$$applyAsyncId === null) {
			self.$$applyAsyncId = setTimeout(function () {
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
		this.$$applyAsyncId = null;
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

	$new() {
		const child = Object.create(this,{$$watchers:{value:[],writable: true, enumerable: true, configurable: true}});
		this.$$children.push(child);
		child.$$children = [];
		return child;
	};

	$$everyScope(fn) {
		if (fn(this)) {
			return this.$$children.every((child) => child.$$everyScope(fn));
		} else {
			return false;
		}
	};
}

const parent = new Scope();
const child = parent.$new();

parent.aValue = 'abc';
child.$watch(
	(scope) => scope.aValue,
	(newValue,oldValue,scope) =>scope.aValueWas = newValue
);

parent.$digest();
console.log('abc',child.aValueWas);

// const child2 = parent.$new();
// const child2_1 = child2.$new();
//
// console.log('2',parent.$$children.length);
// console.log('child1',parent.$$children[0]);
// console.log('child2',parent.$$children[1]);
// console.log('child2_1',child2.$$children[0]);
//
// console.log('0',child1.$$children.length);
// console.log('1',child2.$$children.length);

// parent.aValue = 'abc';
// parent.$watch(
// 	(scope) => scope.aValue,
// 	(newValue,oldValue,scope) => scope.aValues = newValue
// );
//
// child.$digest();
// console.log(child.aValues,'undefined');

// parent.user ={name:'Joe'};
// child.user.name = 'Jill';
//
// child.user.age = 18;
//
// console.log(child.user.age,'childname');
// console.log(parent.user.age,'parentname');



// const parent = new Scope();
// parent.aValue = [1,2,3];
//
// const child = parent.$new();
// child.counter = 0;
//
// child.$watch(
// 	(scope) => scope.aValue,
// 	(newValue,oldValue,scope) => scope.counter++,
// 	true
// );
//
// child.$digest();
// console.log(child.counter,'1');
//
// child.aValue.push(4);
// child.$digest();
//
// console.log(child.counter,'2');
// console.log(child.aValue,'[1,2,3,4]');

// let counter = 0;
// // let gotNewValues;
// // let gotOldValues;
// scope.aValue = 1;
// scope.bValue = 2;
//
// const destroyGroup = scope.$watchGroup([
// 	(scope) => scope.aValue,
// 	(scope) => scope.bValue
// ],(newValues,oldValues,scope) => {
// 	// gotNewValues = newValues;
// 	// gotOldValues = oldValues;
// 	counter++;
// });
// scope.$digest();
//
// scope.bValue = 3;
// destroyGroup();
// scope.$digest();
//
// console.log(counter,'1');

// const watchCalls = [];
//
// scope.$watch(
// 	(scope) => {
// 		watchCalls.push('first');
// 		return scope.aValue;
// 	},
// 	(newValue,oldValue,scope) => {}
//
// );
//
// const destroyWatch = scope.$watch(
// 	() => {
// 		watchCalls.push('second');
// 		destroyWatch();
// 	},
// 	(newValue,oldValue,scope) => {}
// );
//
// scope.$watch(
// 	(scope) => {
// 		watchCalls.push('third');
// 		return scope.aValue;
// 	},
// 	(newValue,oldValue,scope) => {}
// );
//
// scope.$digest();
// console.log(watchCalls);



// scope.counter = 0;
//
// const destroyWatch = scope.$watch(
// 	(scope) => scope.aValue,
// 	(newValue,oldValue,scope) => scope.counter++
// );
//
// scope.$digest();
//
//
// console.log('1',scope.counter);
//
// scope.aValue = 'def';
// scope.$digest();
// console.log('2',scope.counter);
//
// scope.aValue = 'ghi';
// destroyWatch();
// scope.$digest();
// console.log('2',scope.counter);

// scope.$watch(
// 	function (scope) {
// 		scope.counter++;
// 		return scope.aValue;
// 	},
// 	function (newValue,oldValue,scope) {
// 	}
// );
// scope.$applyAsync(function (scope) {
// 	scope.aValue = 'abc';
// });
//
// scope.$applyAsync(function (scope) {
// 	scope.aValue = 'def';
// });
//
// scope.$digest();
// console.log('2',scope.counter);
// console.log('def',scope.aValue);
// setTimeout(function () {
// 	console.log('2',scope.counter);
// },50);

// scope.aValue = 'test apply';
// scope.counter = 0;
//
// scope.$watch(
// 	function (scope) {
// 		return scope.aValue;
// 	},
// 	function (newValue,oldValue,scope) {
// 		scope.counter++;
// 	}
// );
//
// scope.$digest();
// console.log('1',scope.counter);
//
// scope.$apply(function (scope) {
// 	scope.aValue = 'test apply here';
// });
//
// console.log('2',scope.counter);

// scope.aValue = [1, 2, 3];
// scope.asyncEvaluated = false;
// scope.asyncEvaluatedTimes = 0;
//
// scope.$watch(
// 	function(scope) {
// 		if (scope.asyncEvaluatedTimes < 2) {
// 			scope.$evalAsync(function(scope) {
// 				scope.asyncEvaluatedTimes++;
// 			});
// 		}
// 		return scope.aValue;
// 	},
// 	function(newValue, oldValue, scope) { }
// );
//
// scope.$digest();
// console.log('number',scope.asyncEvaluatedTimes);

// scope.aValue = [1, 2, 3];
//
// scope.phaseInWatchFunction = undefined;
// scope.phaseInListenerFunction = undefined;
// scope.phaseInApplyFunction = undefined;
//
// scope.$watch(
// 	function(scope) {
// 		scope.phaseInWatchFunction = scope.$$phase;
// 		return scope.aValue;
// 	},
// 	function(newValue, oldValue, scope) {
// 		scope.phaseInListenerFunction = scope.$$phase;
// 	}
// );
//
// scope.$apply(function(scope) {
// 	scope.phaseInApplyFunction = scope.$$phase;
// });
//
// console.log(scope.phaseInWatchFunction,'$digest');
// console.log(scope.phaseInListenerFunction,'$digest');
// console.log(scope.phaseInApplyFunction,'$apply');

// scope.aValue = "abc";
// scope.counter = 0;
//
// scope.$watch(
// 	function (scope) {
// 		return scope.aValue;
// 	},
// 	function (newValue,oldValue,scope) {
// 		scope.counter++;
// 	}
// );
//
// scope.$evalAsync(function (scope) {
//
// });
//
// console.log('0',scope.counter);
// setTimeout(function () {
// 	console.log(scope.counter,'1');
// },50);