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
const localLogger = {
    debug: console.log,
    error: console.error,
    info: console.log,
    trace: console.log
};
const moduleName = 'sql';
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
        // The default value for `config.options.trustServerCertificate` will change from `true` to `false` in the next major 
        // version of `tedious`. Set the value to `true` or `false` explicitly to silence this message. src/sql.js:68:28
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
                trustServerCertificate: true,
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
// A main method with no command line parameter management
function main(...args) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'main';
        localLogger.info(`${moduleName}, ${methodName}, Starting...`);
        const conn = yield connect(localLogger);
        if (require.main === module) {
            setTimeout(() => { process.exit(0); }, 10000);
        }
        localLogger.info(`${moduleName}, ${methodName}, Ending.`);
        conn.end();
    });
}
// Start the program
if (require.main === module) {
    main();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3FsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3FsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7RUFLRTs7Ozs7Ozs7OztBQUVGLCtCQUErQjtBQUUvQixxQ0FBd0U7QUFHeEUsK0JBQStCO0FBQy9CLDZCQUE2QjtBQUU3QixNQUFNLFdBQVcsR0FBUTtJQUN2QixLQUFLLEVBQUUsT0FBTyxDQUFDLEdBQUc7SUFDbEIsS0FBSyxFQUFFLE9BQU8sQ0FBQyxLQUFLO0lBQ3BCLElBQUksRUFBRSxPQUFPLENBQUMsR0FBRztJQUNqQixLQUFLLEVBQUUsT0FBTyxDQUFDLEdBQUc7Q0FDbkIsQ0FBQztBQUVGLE1BQU0sVUFBVSxHQUFXLEtBQUssQ0FBQztBQUVqQyw4REFBOEQ7QUFDOUQsaUJBQWlCLEdBQVEsRUFBRSxRQUFnQixDQUFDO0lBQzFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztBQUMvQyxDQUFDO0FBRUQsaUJBQXdCLE1BQVc7SUFDakMsTUFBTSxVQUFVLEdBQVcsU0FBUyxDQUFDO0lBRXJDLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7UUFFckMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLFVBQVUsSUFBSSxVQUFVLFlBQVksQ0FBQyxDQUFDO1FBRXJELE1BQU0sTUFBTSxHQUFRLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUM3RixNQUFNLFFBQVEsR0FBVyxNQUFNLENBQUMsUUFBUSxDQUFDO1FBQ3pDLE1BQU0sUUFBUSxHQUFXLE1BQU0sQ0FBQyxRQUFRLENBQUM7UUFDekMsTUFBTSxNQUFNLEdBQVcsTUFBTSxDQUFDLE1B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LENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQzs0QkFDL0QsTUFBTTt3QkFDUixLQUFLLE1BQU07NEJBQ1QsS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7NEJBQy9ELE1BQU07d0JBQ1IsS0FBSyxVQUFVOzRCQUNiLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDOzRCQUMvRCxNQUFNO3dCQUNSLEtBQUssVUFBVTs0QkFDYixLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQzs0QkFDL0QsTUFBTTt3QkFDUixLQUFLLFdBQVc7NEJBQ2QsS0FBSyxHQUFHLE1BQU0sQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7NEJBQy9ELE1BQU07d0JBQ1IsS0FBSyxVQUFVOzRCQUNiLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDOzRCQUMvRCxNQUFNO3dCQUNSLEtBQUssU0FBUzs0QkFDWixLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQzs0QkFDL0QsTUFBTTt3QkFDUjs0QkFDRSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQzs0QkFDL0QsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLFVBQVUsS0FBSyxVQUFVLElBQUk7Z0NBQzNDLHlCQUF5QjtnQ0FDekIsZUFBZSxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sSUFBSTtnQ0FDMUMsWUFBWSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO3FCQUM1QztvQkFDRCxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxLQUFLLENBQUM7aUJBQ3pDO2dCQUNELE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDdkIsQ0FBQyxDQUFDLENBQUM7WUFFSCxVQUFVLENBQUMsRUFBRSxDQUFDLGtCQUFrQixFQUFFLEdBQUcsRUFBRTtnQkFDckMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLFVBQVUsS0FBSyxVQUFVLHNCQUFzQixDQUFDLENBQUM7Z0JBQ2pFLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7b0JBQ3hCLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxZQUFZLEVBQUUsQ0FBQyxDQUFDO2lCQUNoQztnQkFDRCxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMxQixDQUFDLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7U0FDMUI7YUFBTTtZQUNMLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztTQUNsQjtJQUNILENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQXZIRCxnQ0F1SEM7QUFFRCwwREFBMEQ7QUFDMUQsY0FBb0IsR0FBRyxJQUFXOztRQUNoQyxNQUFNLFVBQVUsR0FBVyxNQUFNLENBQUM7UUFFbEMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFVBQVUsS0FBSyxVQUFVLGVBQWUsQ0FBQyxDQUFDO1FBRTlELE1BQU0sSUFBSSxHQUFRLE1BQU0sT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRTdDLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7WUFDM0IsVUFBVSxDQUFDLEdBQUcsRUFBRSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDL0M7UUFFRCxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsVUFBVSxLQUFLLFVBQVUsV0FBVyxDQUFDLENBQUM7UUFFMUQsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ2IsQ0FBQztDQUFBO0FBRUQsb0JBQW9CO0FBQ3BCLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7SUFDM0IsSUFBSSxFQUFFLENBQUM7Q0FDUiJ9