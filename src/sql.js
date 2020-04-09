"use strict";
/*
  sql.ts
  by Don Bales
  on 2018-12-21
  A library to connect, execute DLL and DML against SQL Server
*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/* tslint:disable:no-console */
const tedious_1 = require("tedious");
const tds = require("tedious");
const util = require("util");
// I create this abstraction in case we want to use a different logger like bunyan
const loggur = {
    // debug: debug.toLowerCase().indexOf('sqlserver') > -1 ? console.log : (msg: any) => { return; },
    debug: console.log,
    // error: (msg: any) => { emailer.send(msg, 'ACS ETL Job Error'); console.error(msg); },
    error: console.error,
    info: console.log,
    trace: console.log
};
const moduleName = 'index';
// I create this function to make it easy to develop and debug
function inspect(obj, depth = 5) {
    return util.inspect(obj, true, depth, false);
}
function connect(logger) {
    const methodName = 'connect';
    return new Promise((resolve, reject) => {
        logger.info(`${moduleName}#${methodName}: started.`);
        const config = process.env.DOCTOSQL_RDBMS ? JSON.parse(process.env.DOCTOSQL_RDBMS) : {};
        const database = config.database;
        const password = config.password;
        const server = config.server;
        const userName = config.userName;
        const connectTimeout = (config.connectTimeout !== undefined) ?
            Number.parseInt(config.connectTimeout, 10) : 500000; // five minutes
        const requestTimeout = (config.requestTimeout !== undefined) ?
            Number.parseInt(config.requestTimeout, 10) : 86399997; // almost 24 hours
        const port = (config.port !== undefined) ?
            Number.parseInt(config.port, 10) : 1433;
        const connectionConfig = {
            authentication: {
                options: {
                    password,
                    userName
                },
                type: 'default'
            },
            options: {
                connectTimeout,
                database,
                // If you're on Windows Azure, you will need this:
                encrypt: true,
                port,
                requestTimeout
            },
            server
        };
        const connection = new tedious_1.Connection(connectionConfig);
        connection.on('error', (err) => {
            const error = err;
            console.error(`${moduleName}#${methodName}: ${inspect(error)}`);
            setTimeout(() => {
                process.exit(99);
            }, 5000);
        });
        connection.on('connect', (err) => {
            if (err) {
                const error = err;
                console.error(`${moduleName}#${methodName}: ${inspect(error)}`);
                return reject({ error });
            }
            else {
                return resolve(connection);
            }
        });
    });
}
exports.connect = connect;
function executeDDL(logger, conn, sql) {
    const methodName = 'executeDDL';
    return new Promise((resolve, reject) => {
        logger.info(`${moduleName}, ${methodName}: start`);
        const results = [];
        if (sql) {
            const sqlRequest = new tds.Request(sql, (sqlerr, rowCount) => {
                if (sqlerr) {
                    logger.error(`${moduleName}, ${methodName} \n${inspect(sqlerr)}`);
                    return reject({ error: sqlerr });
                }
                else {
                    logger.info(`${moduleName}, ${methodName}: ${rowCount} rows`);
                }
            });
            logger.info(`${moduleName}, ${methodName}: sql=\n${sql}`);
            sqlRequest.on('row', (columns) => {
                logger.debug(`${moduleName}, ${methodName}: on row, columns=${inspect(columns)}`);
                results.push({ value: columns[0].value });
            });
            sqlRequest.on('requestCompleted', () => {
                logger.debug(`${moduleName}, ${methodName} on requestCompleted`);
                return resolve(results);
            });
            conn.execSql(sqlRequest);
        }
        else {
            resolve(results);
        }
    });
}
exports.executeDDL = executeDDL;
function executeDML(logger, conn, sql, params = []) {
    const methodName = 'executeDML';
    return new Promise((resolve, reject) => {
        logger.info(`${moduleName}, ${methodName}: start`);
        const results = [];
        let rowsAffected = 0;
        if (sql) {
            const sqlRequest = new tds.Request(sql, (sqlerr, rowCount) => {
                if (sqlerr) {
                    // logger.error(`${moduleName}, ${methodName} error: \n${inspect(sqlerr)}`);
                    return reject({ error: sqlerr });
                }
                else {
                    rowsAffected = rowCount;
                    logger.info(`${moduleName}, ${methodName}: ${rowCount} rows`);
                }
            });
            logger.info(`${moduleName}, ${methodName}: sql=\n${sql}`);
            if (params &&
                params.length > 0) {
                for (const param of params) {
                    sqlRequest.addParameter(param[0], tds.TYPES.VarChar, param[1]);
                }
            }
            sqlRequest.on('row', (columns) => {
                // logger.debug(`${moduleName}, ${methodName}: on row`);
                const result = {};
                for (const column of columns) {
                    // logger.debug(`${moduleName}, ${methodName}: column_name=${column.metadata.colName}`);
                    // logger.debug(`${moduleName}, ${methodName}: value=${inspect(column.value)}`);
                    // logger.debug(`${moduleName}, ${methodName}: javascript type=${typeof column.value}`);
                    // logger.debug(`${moduleName}, ${methodName}: tds type=${column.metadata.type.name}`);
                    let value;
                    switch (column.metadata.type.name) {
                        case 'BigInt':
                            value = column.value !== null ? column.value.toString() : null;
                            break;
                        case 'Bit':
                            value = column.value !== null ? column.value : null;
                            break;
                        case 'BitN':
                            value = column.value !== null ? column.value : null;
                            break;
                        case 'Date':
                            value = column.value !== null ? new Date(column.value.toString()) : null;
                            break;
                        case 'DateTime':
                            value = column.value !== null ? new Date(column.value.toString()) : null;
                            break;
                        case 'DateTime2':
                            value = column.value !== null ? new Date(column.value.toString()) : null;
                            break;
                        case 'DateTimeN':
                            value = column.value !== null ? new Date(column.value.toString()) : null;
                            break;
                        case 'DateTimeOffset':
                            value = column.value !== null ? new Date(column.value.toString()) : null;
                            break;
                        case 'DecimalN':
                            value = column.value !== null ? column.value.toString() : null;
                            break;
                        case 'FloatN':
                            value = column.value !== null ? column.value : null;
                            break;
                        case 'Int':
                            value = column.value !== null ? column.value.toString() : null;
                            break;
                        case 'IntN':
                            value = column.value !== null ? column.value.toString() : null;
                            break;
                        case 'NumericN':
                            value = column.value !== null ? column.value.toString() : null;
                            break;
                        case 'SmallInt':
                            value = column.value !== null ? column.value.toString() : null;
                            break;
                        case 'VarBinary':
                            value = column.value !== null ? column.value.toString() : null;
                            break;
                        case 'NVarChar':
                            value = column.value !== null ? column.value.toString() : null;
                            break;
                        case 'VarChar':
                            value = column.value !== null ? column.value.toString() : null;
                            break;
                        default:
                            value = column.value !== null ? column.value.toString() : null;
                            logger.error(`${moduleName}, ${methodName}: ` +
                                `Unsupported data type: ` +
                                `column name=${column.metadata.colName}, ` +
                                `tds type=${column.metadata.type.name}`);
                    }
                    result[column.metadata.colName] = value;
                }
                results.push(result);
            });
            sqlRequest.on('requestCompleted', () => {
                logger.debug(`${moduleName}, ${methodName} on requestCompleted`);
                if (results.length === 0) {
                    results.push({ rowsAffected });
                }
                return resolve(results);
            });
            conn.execSql(sqlRequest);
        }
        else {
            resolve(results);
        }
    });
}
exports.executeDML = executeDML;
// Log the start of a job
function insertEtlJobHistory(logger, conn, jobName) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'insertEtlJobHistory';
        logger.info(`${moduleName}, ${methodName}: start`);
        const startDate = new Date().toISOString();
        const sql = `insert into ETL_JOB_HISTORY (JOB_NAME, START_DATE) output INSERTED.ID values (@JOB_NAME, '${startDate}')`;
        const params = [['JOB_NAME', jobName]];
        let results = null;
        try {
            results = yield executeDML(logger, conn, sql, params);
            logger.debug(`${moduleName}, ${methodName}: ${inspect(results)}`);
        }
        catch (err) {
            logger.error(`${moduleName}, ${methodName}: ${err}`);
            process.exit(1);
        }
        return results[0].ID;
    });
}
exports.insertEtlJobHistory = insertEtlJobHistory;
// Get the last update date for the underlying dataset, for the last successful job
function selectEtlJobHistory(logger, conn, jobName) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'selectEtlJobHistory';
        logger.info(`${moduleName}, ${methodName}: start`);
        const stopDate = new Date().toISOString();
        const sql = `
    select max(s1.LAST_UPDATE_DATE) last_update_date
    from   ETL_JOB_HISTORY s1
    where  s1.JOB_NAME = @JOB_NAME
    and    s1.START_DATE = (
      select max(s2.START_DATE)
      from   ETL_JOB_HISTORY s2
      where  s2.JOB_NAME = @JOB_NAME
      and    s2.END_DATE is not NULL)
    and    s1.END_DATE is not NULL`;
        const params = [['JOB_NAME', jobName]];
        let results = null;
        try {
            results = yield executeDML(logger, conn, sql, params);
            logger.debug(`${moduleName}, ${methodName}: ${inspect(results)}`);
        }
        catch (err) {
            logger.error(`${moduleName}, ${methodName}: ${err}`);
            process.exit(1);
        }
        let result = '1900-01-01T00:00:00Z';
        if (results &&
            results instanceof Array &&
            results.length === 1 &&
            results[0].last_update_date &&
            results[0].last_update_date instanceof Date) {
            result = results[0].last_update_date.toISOString().slice(0, 19) + 'Z';
        }
        logger.info(`${moduleName}, ${methodName}: result=${result}`);
        return result;
    });
}
exports.selectEtlJobHistory = selectEtlJobHistory;
// Get the last update date for the specifued dataset
function selectLastUpdateDate(logger, conn, table, column) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'selectLastUpdateDate';
        logger.info(`${moduleName}, ${methodName}: start`);
        const stopDate = new Date().toISOString();
        const sql = `select max(${column.toLocaleUpperCase()}) last_update_date from ${table.toLocaleUpperCase()}`;
        const params = [];
        let results = null;
        try {
            results = yield executeDML(logger, conn, sql, params);
            logger.debug(`${moduleName}, ${methodName}: ${inspect(results)}`);
        }
        catch (err) {
            logger.error(`${moduleName}, ${methodName}: ${err}`);
            process.exit(1);
        }
        let result = '1900-01-01T00:00:00Z';
        if (results &&
            results instanceof Array &&
            results.length === 1 &&
            results[0].last_update_date &&
            results[0].last_update_date instanceof Date) {
            const thirtyOneDays = 31 * 24 * 60 * 60 * 1000;
            const lastUpdateDate = new Date(results[0].last_update_date.getTime() - thirtyOneDays);
            result = lastUpdateDate.toISOString().slice(0, 19) + 'Z';
        }
        logger.info(`${moduleName}, ${methodName}: result=${result}`);
        return result;
    });
}
exports.selectLastUpdateDate = selectLastUpdateDate;
// Log the end of a successful job
function updateEtlJobHistory(logger, conn, id, table = '', column = '') {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'updateEtlJobHistory';
        logger.info(`${moduleName}, ${methodName}: start`);
        let lastUpdateDate = '1900-01-01T00:00:00Z';
        if (table && column) {
            lastUpdateDate = yield selectLastUpdateDate(logger, conn, table, column);
        }
        const endDate = new Date().toISOString();
        const sql = `update u set u.REV = u.REV + 1, ` +
            `u.END_DATE = '${endDate}', u.LAST_UPDATE_DATE = '${lastUpdateDate}' ` +
            `from ETL_JOB_HISTORY u where u.ID = @ID`;
        const params = [['ID', id]];
        let results = null;
        try {
            results = yield executeDML(logger, conn, sql, params);
            logger.debug(`${moduleName}, ${methodName}: ${inspect(results)}`);
        }
        catch (err) {
            logger.error(`${moduleName}, ${methodName}: ${err}`);
            process.exit(1);
        }
        return results[0].rowsAffected;
    });
}
exports.updateEtlJobHistory = updateEtlJobHistory;
// A main method with no command line parameter management
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'main';
        loggur.info({ moduleName, methodName }, `Starting...`);
        const conn = yield connect(loggur);
        const lastStartDate = yield selectEtlJobHistory(loggur, conn, 'sqlserver');
        loggur.info({ moduleName, methodName, lastStartDate });
        const id = yield insertEtlJobHistory(loggur, conn, 'sqlserver');
        loggur.info({ moduleName, methodName, id });
        const result = yield updateEtlJobHistory(loggur, conn, id);
        loggur.info({ moduleName, methodName, result });
        if (require.main === module) {
            setTimeout(() => { process.exit(0); }, 10000);
        }
        loggur.info({ moduleName, methodName }, `Ending.`);
    });
}
// Start the program
if (require.main === module) {
    main();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3FsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3FsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7RUFLRTs7Ozs7Ozs7OztBQUVGLCtCQUErQjtBQUUvQixxQ0FBd0U7QUFJeEUsK0JBQStCO0FBQy9CLDZCQUE2QjtBQUU3QixrRkFBa0Y7QUFDbEYsTUFBTSxNQUFNLEdBQVE7SUFDbEIsa0dBQWtHO0lBQ2xHLEtBQUssRUFBRSxPQUFPLENBQUMsR0FBRztJQUNsQix3RkFBd0Y7SUFDeEYsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO0lBQ3BCLElBQUksRUFBRSxPQUFPLENBQUMsR0FBRztJQUNqQixLQUFLLEVBQUUsT0FBTyxDQUFDLEdBQUc7Q0FDbkIsQ0FBQztBQUVGLE1BQU0sVUFBVSxHQUFXLE9BQU8sQ0FBQztBQUVuQyw4REFBOEQ7QUFDOUQsaUJBQWlCLEdBQVEsRUFBRSxRQUFnQixDQUFDO0lBQzFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztBQUMvQyxDQUFDO0FBRUQsaUJBQXdCLE1BQVc7SUFDakMsTUFBTSxVQUFVLEdBQVcsU0FBUyxDQUFDO0lBRXJDLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7UUFFckMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLFVBQVUsSUFBSSxVQUFVLFlBQVksQ0FBQyxDQUFDO1FBRXJELE1BQU0sTUFBTSxHQUFRLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUM3RixNQUFNLFFBQVEsR0FBVyxNQUFNLENBQUMsUUFBUSxDQUFDO1FBQ3pDLE1BQU0sUUFBUSxHQUFXLE1BQU0sQ0FBQyxRQUFR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RUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7NEJBQy9ELE1BQU07d0JBQ1IsS0FBSyxNQUFNOzRCQUNULEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDOzRCQUMvRCxNQUFNO3dCQUNSLEtBQUssVUFBVTs0QkFDYixLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQzs0QkFDL0QsTUFBTTt3QkFDUixLQUFLLFVBQVU7NEJBQ2IsS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7NEJBQy9ELE1BQU07d0JBQ1IsS0FBSyxXQUFXOzRCQUNkLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDOzRCQUMvRCxNQUFNO3dCQUNSLEtBQUssVUFBVTs0QkFDYixLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQzs0QkFDL0QsTUFBTTt3QkFDUixLQUFLLFNBQVM7NEJBQ1osS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7NEJBQy9ELE1BQU07d0JBQ1I7NEJBQ0UsS0FBSyxHQUFHLE1B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