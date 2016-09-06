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

	$$digestOnce() {
		const self = this;
		let newValue,oldValue,dirty;
		_.forEachRight(this.$$watchers,function (watcher) {
			try {
				if (watcher) {
					newValue = watcher.watchFn(self);
					oldValue = watcher.last;
					if (!self.$$areEqual(newValue,oldValue,watcher.valueEq)){
						self.$$lastDirtyWatch = watcher;
						watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
						watcher.listenerFn(newValue,
							(oldValue === initWatchVal ? newValue : oldValue),
							self);
						dirty = true;
					}else if(self.$$lastDirtyWatch === watcher){
						return false;
					}
				}
			} catch (e) {
				console.error(e);
			}
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
}

const scope = new Scope();

scope.aValue = 'abc';

const watchCalls = [];

scope.$watch(
	(scope) => {
		watchCalls.push('first');
		return scope.aValue;
	},
	(newValue,oldValue,scope) => {}

);

const destroyWatch = scope.$watch(
	(scope) => {
		watchCalls.push('second');
		destroyWatch();
	},
	(newValue,oldValue,scope) => {}
);

scope.$watch(
	(scope) => {
		watchCalls.push('third');
		return scope.aValue;
	},
	(newValue,oldValue,scope) => {}
);

scope.$digest();
console.log(watchCalls);







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