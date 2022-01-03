//quality of life vars
var getServerMoneyAvailable;
var getServerMaxMoney;
var getServerSecurityLevel;
var getServerMinSecurityLevel;
var growthAnalyze;
var weakenAnalyze;
var hackAnalyze;
var run;
var getHostname;
var getServerRam;

//actual vars 
var hostName;
var scriptsPath = '/hackingScripts/';
var weakenScriptPath = 'weaken.script';
var growthScriptPath = 'grow.script';
var hackScriptPath = 'hack.script';
var weakenType = 'weaken';
var hackType = 'hack';
var growType = 'grow';
var growthFactor = 0.9;
var costToWeaken;
var costToGrow;
var costToHack;
var homeCores = 2;
var portHandle;
var portNum;

export async function main(ns) {
	setGlobals(ns);
	ns.disableLog('ALL');
	hostName = ns.args[0];
	await mainLoop(ns);
}

async function mainLoop(ns) {
	while (true) {
		if (!portHandle.empty()) {
			print(await portHandle.read())
		}
		if (!isSecurityMin(hostName) && canRunScript(weakenScriptPath, weakenType, ns)) {
			var pid = run(scriptsPath + weakenScriptPath, findMaxThreadsNeededToWeaken(), hostName, portNum);
			print('weakening ' + hostName + ' with pid ' + pid)
		}
		if (!hasServerReachedMoneyGoal() && canRunScript(growthScriptPath, growType, ns)) {
			var pid = run(scriptsPath + growthScriptPath, findMaxThreadsNeededToGrow(), hostName, portNum);
			print('growing ' + hostName + ' with pid ' + pid)
		}
		if (hasServerReachedMoneyGoal() && canRunScript(hackScriptPath, hackType, ns)) {
			var pid = run(scriptsPath + hackScriptPath, findMaxThreadsNeededToHack(), hostName, portNum);
			print('hacking ' + hostName + ' with pid ' + pid)
		}
		await ns.sleep(1000)
	}
}

function hasServerReachedMoneyGoal() {
	return getServerMoneyAvailable(hostName) >= getServerMaxMoney(hostName) * growthFactor;
}

function canRunScript(path, type, ns) {
	return !ns.isRunning(scriptsPath + path, ns.getHostname(), hostName, portNum) && getMaxThreadsForType(type) > 1
}

function isSecurityMin(server) {
	return getServerSecurityLevel(server) - getServerMinSecurityLevel(server) < 1;
}

function findMaxThreadsNeededToHack() {
	var res = binarySearch(getServerMoneyAvailable(hostName) * 0.5, 'hack');
	if (res < 1) {
		print('WARN tried returning ' + res + ' threads in hack');
		res = 1;
	}
	return res
}

function findMaxThreadsNeededToGrow() {
	var currMoney = getServerMoneyAvailable(hostName);
	if (currMoney === 0) return getMaxThreadsForGrowth();
	var target = (getServerMaxMoney(hostName) * growthFactor) / currMoney;
	var res = Math.min(Math.round(growthAnalyze(hostName, target, homeCores)) + 1, getMaxThreadsForGrowth());
	if (res < 1) {
		print('WARN tried returning ' + res + ' threads in grow');
		res = 1;
	}
	return res;
}

function findMaxThreadsNeededToWeaken() {
	var securityLevel = getServerSecurityLevel(hostName);
	var securityToDecrease = securityLevel - getServerMinSecurityLevel(hostName);
	var res = binarySearch(securityToDecrease, weakenType);
	if (res < 1) {
		print('WARN tried returning ' + res + ' threads in weaken');
		res = 1;
	}
	return res
}

function binarySearch(targetValue, type) {
	var maxThreads = getMaxThreadsForType(type);
	var minThreads = 1;
	if (analyze(targetValue, maxThreads, type) < targetValue) return maxThreads; //this is the best we can do
	if (analyze(targetValue, minThreads, type) > targetValue) return minThreads;
	return binarySearchHelper(1, maxThreads, targetValue, type);
}

function binarySearchHelper(minThreads, maxThreads, targetValue, type) {
	if (Math.abs(minThreads - maxThreads) < 1) return Math.round(maxThreads);
	var avgThreads = (minThreads + maxThreads) / 2;
	var avgValue = analyze(targetValue, avgThreads, type);
	if (avgValue === targetValue)
		return avgThreads;
	if (avgValue > targetValue)
		return binarySearchHelper(minThreads, avgThreads, targetValue, type);
	return binarySearchHelper(avgThreads, maxThreads, targetValue, type);
}

function analyze(targetValue, threads, type) {
	if (type === growType) {
		return growthAnalyze(hostName, targetValue, homeCores);
	}
	if (type === weakenType) {
		return weakenAnalyze(threads, homeCores);
	}
	if (type === hackType) {
		return hackAnalyze(hostName) * getServerMoneyAvailable(hostName) * threads;
	}
}

function getMaxThreadsForType(type) {
	if (type === growType) {
		return getMaxThreadsForGrowth();
	}
	if (type === weakenType) {
		return getMaxThreadsForWeaken()
	}
	if (type === hackType) {
		return getMaxThreadsForHack()
	}
}

function setGlobals(ns) {
	print = ns.print;
	getServerMoneyAvailable = ns.getServerMoneyAvailable;
	getServerSecurityLevel = ns.getServerSecurityLevel;
	getServerMinSecurityLevel = ns.getServerMinSecurityLevel;
	growthAnalyze = ns.growthAnalyze;
	weakenAnalyze = ns.weakenAnalyze;
	getServerMaxMoney = ns.getServerMaxMoney;
	hackAnalyze = ns.hackAnalyze;
	getHostname = ns.getHostname;
	getServerRam = ns.getServerRam;
	run = ns.run;
	portNum = ns.args[1];
	portHandle = ns.getPortHandle(portNum);
	costToWeaken = ns.getScriptRam(scriptsPath + weakenScriptPath);
	costToGrow = ns.getScriptRam(scriptsPath + growthScriptPath);
	costToHack = ns.getScriptRam(scriptsPath + hackScriptPath);
}

function getMaxThreadsForGrowth() {
	return getAvailableRamOnServer() / costToGrow;
}

function getMaxThreadsForWeaken() {
	return getAvailableRamOnServer() / costToWeaken;
}

function getMaxThreadsForHack() {
	return getAvailableRamOnServer() / costToHack;
}

function getAvailableRamOnServer() {
	var serverRam = getServerRam(getHostname());
	return serverRam[0] - serverRam[1];
}

function doesHomeHaveEnoughRam() {
	return getMaxThreadsForWeaken() > 1 || getMaxThreadsForGrowth() > 1 || getMaxThreadsForHack() > 1;
}
