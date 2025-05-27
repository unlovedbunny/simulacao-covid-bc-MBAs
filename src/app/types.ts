export class GlobalSimulationData {
    globalFatalities: number;
    globalRecovered: number;
    globalSusceptible: number;
    globalInfected: number;
    public simulationResultS: number[];
    public simulationResultI: number[];
    public simulationResultR: number[];
    public simulationResultF: number[];
    earlyPeak: Country;
    lowPeak: Country;
    latePeak: Country;
    highPeak: Country;
}

export class Country {
    fractionIncoming: number;
    fractionOutgoing: number;
    nameCode: string;
    nameFull: string;
    totalInhabitants: number;
    public initialInfected: number;
    public simulationResultS: number[];
    public simulationResultI: number[];
    public simulationResultR: number[];
    public simulationResultF: number[];
    public globalPeakStep = -1;
    public globalPeakRate = 0;
    public simulationResultCriticalTimestep: boolean[];
    isCiriticalStateTrackingEnabled: boolean;
    baseMortality: number;
    criticalMortality: number;
    criticalThreshold: number;

    constructor(inCode: string, inName: string, inInitialInfected: number, inTotalInhabitants: number, inInc: number, inOut: number) {
        this.initialInfected = inInitialInfected;
        this.totalInhabitants = inTotalInhabitants;
        this.fractionIncoming = inInc;
        this.fractionOutgoing = inOut;
        this.nameCode = inCode;
        this.nameFull = inName;
        this.isCiriticalStateTrackingEnabled = false;
        this.clear();
    }

    setMortality(in_mortality: number) {
        this.baseMortality = in_mortality;
    }

    setCriticalProperties(enableCriticalTracking: boolean, baseMortality: number, criticalMortality: number, criticalThreshold: number) {
        this.isCiriticalStateTrackingEnabled = enableCriticalTracking;
        this.baseMortality = baseMortality;
        this.criticalMortality = criticalMortality;
        this.criticalThreshold = criticalThreshold;
    }

    interpolateDataForTime(inTime: number): {s: number, i: number, r: number} {
        const ret = {s: 0, i: 0, r: 0};
        if (inTime > this.simulationResultR.length - 1) {
            inTime = this.simulationResultR.length - 1;
        }
        if ( inTime < 0) {
            inTime = 0;
        }
        if ( Math.floor(inTime) === inTime) {
            ret.s = this.simulationResultS[inTime];
            ret.i = this.simulationResultI[inTime];
            ret.r = this.simulationResultR[inTime];
        } else {
            const lower = Math.floor(inTime);
            const frac = inTime - lower;
            ret.s += frac * this.simulationResultS[lower];
            ret.s += (1 - frac) * this.simulationResultS[lower + 1];
            ret.i += frac * this.simulationResultI[lower];
            ret.i += (1 - frac) * this.simulationResultI[lower + 1];
            ret.r += frac * this.simulationResultR[lower];
            ret.r += (1 - frac) * this.simulationResultR[lower + 1];
        }
        return ret;
    }

    interpolateRateForTime(inTime: number): {s: number, i: number, r: number} {
        const ret = this.interpolateDataForTime(inTime);
        ret.i /= this.totalInhabitants;
        ret.r /= this.totalInhabitants;
        ret.s /= this.totalInhabitants;
        return ret;
    }

    getMaxRRate(): number {
        let ret = 0;
        this.simulationResultR.forEach((val) => {
            if (val > ret) {
                ret = val;
            }
        });
        return ret / this.totalInhabitants;
    }

    getMaxIRate(): number {
        let ret = 0;
        this.simulationResultI.forEach((val) => {
            if (val > ret) {
                ret = val;
            }
        });
        return ret / this.totalInhabitants;
    }

    clear() {
        this.simulationResultS = [];
        this.simulationResultI = [];
        this.simulationResultR = [];
        this.simulationResultCriticalTimestep = [];
        this.simulationResultF = [];
        this.simulationResultS.push(this.totalInhabitants);
        this.simulationResultI.push(this.initialInfected);
        this.simulationResultR.push(0);
        this.simulationResultF.push(0);
    }

    getLatestS(): number {
        if (this.simulationResultS.length > 0) {
            return this.simulationResultS[this.simulationResultS.length - 1];
        } else {
            return 0;
        }
    }

    getLatestI(): number {
        if (this.simulationResultI.length > 0) {
            return this.simulationResultI[this.simulationResultI.length - 1];
        } else {
            return 0;
        }
    }

    getLatestIShare(): number {
        return this.getLatestI() / this.totalInhabitants;
    }

    getLatestSShare(): number {
        return this.getLatestS() / this.totalInhabitants;
    }

    getLatestR(): number {
        if (this.simulationResultR.length > 0) {
            return this.simulationResultR[this.simulationResultR.length - 1];
        } else {
            return 0;
        }
    }

    addSimulationResultS(newS: number) {
        this.simulationResultS.push(Math.max(0, this.getLatestS() + newS));
    }

    addSimulationResultI(newI: number) {
        this.simulationResultI.push(Math.max(0, this.getLatestI() + newI));
    }

    addSimulationResultR(newR: number) {
        this.simulationResultR.push(Math.max(0, this.getLatestR() + newR));
        if (this.isCiriticalStateTrackingEnabled) {
            if ( this.getLatestIShare() >= this.criticalThreshold ) {
                this.simulationResultCriticalTimestep.push(true);
                this.simulationResultF.push(Math.max(0, this.getLatestR() + newR * this.criticalMortality) );
            } else {
                this.simulationResultCriticalTimestep.push(false);
                this.simulationResultF.push(Math.max(0, this.getLatestR() + newR * this.baseMortality) );
            }
        } else {
            this.simulationResultF.push(Math.max(0, this.getLatestR() + newR) * this.baseMortality);
        }
    }

    getSVectorTotal(rate: boolean): number[] {
        const ret = [];
        for (let i = 0; i < this.simulationResultS.length; i++) {
            ret.push(this.simulationResultS[i]);
        }
        if (rate) {
            const count = this.totalInhabitants;
            for (let i = 0; i < this.simulationResultS.length; i++) {
                ret[i] = ret[i] / count;
                if (ret[i] < 0) {
                    ret[i] = 0;
                }
                if (ret[i] > 1) {
                    ret[i] = 1;
                }
                ret[i] *= 100;
            }
        } else {
            for (let i = 0; i < this.simulationResultS.length; i++) {
                ret[i] = Math.floor(ret[i]);
            }
        }
        return ret;
    }

    getIVectorTotal(rate: boolean): number[] {
        const ret = [];
        for (let i = 0; i < this.simulationResultI.length; i++) {
            ret.push(this.simulationResultI[i]);
        }
        if (rate) {
            const count = this.totalInhabitants;
            for (let i = 0; i < this.simulationResultI.length; i++) {
                ret[i] = ret[i] / count;
                if (ret[i] < 0) {
                    ret[i] = 0;
                }
                if (ret[i] > 1) {
                    ret[i] = 1;
                }
                ret[i] *= 100;
            }
        } else {
            for (let i = 0; i < this.simulationResultI.length; i++) {
                ret[i] = Math.floor(ret[i]);
            }
        }
        return ret;
    }

    getRVectorTotal(rate: boolean): number[] {
        const ret = [];
        for (let i = 0; i < this.simulationResultR.length; i++) {
            ret.push(this.simulationResultR[i]);
        }
        if (rate) {
            const count = this.totalInhabitants;
            for (let i = 0; i < this.simulationResultR.length; i++) {
                ret[i] = ret[i] / count;
                if (ret[i] < 0) {
                    ret[i] = 0;
                }
                if (ret[i] > 1) {
                    ret[i] = 1;
                }
                ret[i] *= 100;
            }
        } else {
            for (let i = 0; i < this.simulationResultR.length; i++) {
                ret[i] = Math.floor(ret[i]);
            }
        }
        return ret;
    }

    getFVectorTotal(rate: boolean): number[] {
        const ret = [];
        for (let i = 0; i < this.simulationResultF.length; i++) {
            ret.push(this.simulationResultF[i]);
        }
        if (rate) {
            const count = this.totalInhabitants;
            for (let i = 0; i < this.simulationResultF.length; i++) {
                ret[i] = ret[i] / count;
                if (ret[i] < 0) {
                    ret[i] = 0;
                }
                if (ret[i] > 1) {
                    ret[i] = 1;
                }
                ret[i] *= 100;
            }
        } else {
            for (let i = 0; i < this.simulationResultF.length; i++) {
                ret[i] = Math.floor(ret[i]);
            }
        }
        return ret;
    }

    getFatalities(rate: boolean): number[] {
        const ret = this.getFVectorTotal(rate);
        if (!rate) {
            for (let i = 0; i < ret.length; i++) {
                ret[i] = Math.floor(ret[i]);
            }
        } else {
            for (let i = 0; i < ret.length; i++) {
                ret[i] *= 100;
            }
        }
        return ret;
    }

    computeGlobalPeak() {
        for (let i = 0; i < this.simulationResultI.length; i++) {
            const temp_rate = this.simulationResultI[i] / this.totalInhabitants;
            if (temp_rate > this.globalPeakRate ) {
                this.globalPeakStep = i;
                this.globalPeakRate = temp_rate;
            }
        }
    }
}
