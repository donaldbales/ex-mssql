"use strict";
// index.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const bunyan = require("bunyan");
const fs = require("fs");
const minimist = require("minimist");
const util = require("util");
const sql = require("./sql");
let logger;
const moduleName = 'index';
const possibleTasks = [
    'counts',
    'descs',
    'histograms',
    'search'
];
// I create this function to make it easy to develop and debug
function inspect(obj, depth = 7) {
    return util.inspect(obj, true, depth, false);
}
function argz(args = null) {
    const methodName = 'argz';
    // console.error(`${moduleName}#${methodName}: Starting...`);
    // console.error(inspect(args)); 
    // console.error(inspect(process.argv.slice(2)));
    const localArgs = minimist(args && args.length > 0 ? args : process.argv.slice(2), {
        alias: {
            h: 'help',
            l: 'like',
            p: 'parameter',
            s: 'search',
            t: 'tasks',
            v: 'version'
        },
        default: {
            t: possibleTasks.join(',')
        }
    });
    const pkg = JSON.parse(fs.readFileSync('package.json').toString());
    const name = pkg.name ? pkg.name : '';
    const version = pkg.version ? pkg.version : '';
    if (localArgs.version) {
        console.log(`${version}`);
        process.exit(0);
    }
    if (localArgs.help) {
        console.log(`Usage: node src/index [options]\n`);
        console.log(`Options:`);
        console.log(`  -h, --help     print ${name} command line options`);
        console.log(`  -t, --tasks    specify task(s) to run: ${possibleTasks.join(', ')}.`);
        console.log(`  -v, --version  print ${name} version`);
        process.exit(0);
    }
    const like = localArgs.like ? true : false;
    const search = localArgs.search;
    const parameter = localArgs.parameter ? localArgs.parameter.toString() : '';
    const result = { like, search, tasks: {}, parameter };
    const tasks = localArgs.tasks.split(',');
    // console.error(tasks);
    for (const task of tasks) {
        let found = false;
        for (const possibleTask of possibleTasks) {
            if (possibleTask === task) {
                found = true;
                break;
            }
        }
        if (found) {
            result.tasks[task] = true;
        }
        else {
            console.error(`Task: ${task}, is not in the list of supported tasks: ${possibleTasks.join(', ')}.`);
            setTimeout(() => { process.exit(1); }, 10000);
        }
    }
    return result;
}
function databases(logger, conn) {
    return __awaiter(this, void 0, void 0, function* () {
        let results = [];
        const query = `
    SELECT name 
    FROM   master.dbo.sysdatabases 
    WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
/*    AND   name like 'H70_%'
    AND   name != 'H70_AUDITTRAIL' */
    ORDER BY 1`;
        try {
            results = yield sql.executeDML(logger, conn, query, []);
        }
        catch (err) {
            logger.error({ err });
            process.exit(99);
        }
        return results;
    });
}
function tablesAndColumns(logger, conn) {
    return __awaiter(this, void 0, void 0, function* () {
        let results = [];
        const query = `
    select TABLE_SCHEMA,
           TABLE_NAME,
           COLUMN_NAME
    from   INFORMATION_SCHEMA.COLUMNS
    where  DATA_TYPE != 'image'
    order by 1, 2, 3
  `;
        try {
            results = yield sql.executeDML(logger, conn, query, []);
        }
        catch (err) {
            logger.error({ err });
            process.exit(99);
        }
        return results;
    });
}
function tablesAndIDColumns(logger, conn) {
    return __awaiter(this, void 0, void 0, function* () {
        let results = [];
        const query = `
      select TABLE_SCHEMA,
             TABLE_NAME,
             COLUMN_NAME
      from   INFORMATION_SCHEMA.COLUMNS
      where (lower(COLUMN_NAME) like '%_id'
      or     lower(COLUMN_NAME) = 'sku')
      order by 1, 2, 3
    `;
        try {
            results = yield sql.executeDML(logger, conn, query, []);
        }
        catch (err) {
            logger.error({ err });
            process.exit(99);
        }
        return results;
    });
}
function tablesAndStringColumns(logger, conn) {
    return __awaiter(this, void 0, void 0, function* () {
        let results = [];
        const query = `
      select TABLE_SCHEMA,
             TABLE_NAME,
             COLUMN_NAME
      from   INFORMATION_SCHEMA.COLUMNS
      where  DATA_TYPE in ('binary', 'varbinary', 'char', 'nchar', 'ntext', 'text', 'nvarchar', 'varchar')
      order by 1, 2, 3
    `;
        try {
            results = yield sql.executeDML(logger, conn, query, []);
        }
        catch (err) {
            logger.error({ err });
            process.exit(99);
        }
        return results;
    });
}
function counts(logger, conn, tables) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = { tables: {} };
        let i = 0;
        for (const tableName of tables.keys()) {
            let query;
            query = `select count(1) "count" from ${tableName}`;
            console.error(query);
            try {
                const rows = yield sql.executeDML(logger, conn, query, []);
                // console.error(rows);
                for (const row of rows) {
                    if (row.count && row.count.toString) {
                        const count = `${row.count.toString().trimRight()}`;
                        results.tables[tableName] = count;
                    }
                }
            }
            catch (err) {
                // console.error(inspect(err));
                results.tables[tableName] = err.error.message;
            }
        }
        return results;
    });
}
function descs(logger, conn, tables) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = { tables: {} };
        let i = 0;
        for (const tableName of tables.keys()) {
            let query;
            query = `sp_help "${tableName}";`;
            console.error(`\n${query}`);
            try {
                const rows = yield sql.executeDML(logger, conn, query, []);
                // console.log(`rows=${inspect(rows)}`);
                let desc = '';
                for (const row of rows) {
                    console.log(row);
                    desc += `${row}\n`;
                }
                results.tables[tableName] = desc;
            }
            catch (err) {
                console.error(`err=${inspect(err)}`);
                results.tables[tableName] = err.error.message;
            }
            // break;
        }
        return results;
    });
}
function histograms(logger, conn, tables) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = { tables: {} };
        for (const tableName of tables.keys()) {
            console.error(`/** ${tableName} */`);
            results.tables[tableName] = [];
            for (const columnName of tables.get(tableName)) {
                console.error(`/*** ${columnName} */`);
                if (columnName === 'next_val') {
                    continue;
                }
                else if (tableName === 'H70_AUDITTRAIL.dbo.sysdiagrams' &&
                    columnName === 'definition') {
                    continue;
                }
                let query;
                query = `
        select top(100)
               cast([${columnName}] as varchar(80)) "${columnName}", 
               count(1) "count" 
        from   ${tableName} 
        group by cast([${columnName}] as varchar(80)) 
        order by count(1) desc
      `;
                console.error(query);
                try {
                    const rows = yield sql.executeDML(logger, conn, query, []);
                    for (const row of rows) {
                        if (row.count && row.count.toString) {
                            results.tables[tableName].push(row);
                        }
                    }
                }
                catch (err) {
                    results.tables[tableName].push(err.error.message);
                }
                // break;
            }
            // break;
        }
        return results;
    });
}
/*
async function ids(conn: any, tables: any): Promise<any> {
  const results: any = { ids: new Map() };

  let i: number = 0;
  for (const tableName of tables.keys()) {
    let sql: string;
    for (const columnName of tables.get(tableName)) {
      sql = `select distinct \`${columnName}\` as ID from ${database}.\`${tableName}\``;

      console.error(sql);

      const value: string = `${tableName}\t${columnName}`;
      try {
        const rows: any = await select(conn, sql);
        // console.error(rows);
        for (const row of rows) {
          if (row.ID && row.ID.toString) {
            const id: string = `"${row.ID.toString().trimRight()}"`;
            if (results.ids.has(id)) {
              if (!results.ids.get(id).has(value)) {
                results.ids.get(id).add(value);
              }
            } else {
              results.ids.set(id, new Set([ value ]));
            }
            // if (++i > 5) {
            //   break;
            // }
          }
        }
      } catch (err) {
        results.error = err;
        console.error(results.error);
        return results;
      }
    }
    // if (++i === 25) {
    //   break;
    // }
  }
  return results;
}
*/
function search(logger, conn, tables, str = '', like = false) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = { rows: [] };
        for (const tableName of tables.keys()) {
            for (const columnName of tables.get(tableName)) {
                const label = `${tableName}.${columnName}`;
                let query = `
        select count(1) "${label}"
        from   ${tableName}
        where  `;
                /*
                      query +=   `lower(cast(${columnName} as varchar(8000))) = '${str}'\n        or     `;
                      if (like) {
                        query += `lower(cast(${columnName} as varchar(8000))) like '${str} %'\n        or     `;
                        query += `lower(cast(${columnName} as varchar(8000))) like '% ${str} %'\n        or     `;
                        query += `lower(cast(${columnName} as varchar(8000))) like '% ${str}'\n        or     `;
                      }
                */
                query += `cast([${columnName}] as varchar(800)) = '${str}'\n        or     `;
                if (like) {
                    query += `cast([${columnName}] as varchar(800)) like '${str}%'\n        or     `;
                    query += `cast([${columnName}] as varchar(800)) like '%${str}%'\n        or     `;
                    query += `cast([${columnName}] as varchar(800)) like '%${str}'\n        or     `;
                }
                query = query.slice(0, -15);
                console.error(query);
                try {
                    const rows = yield sql.executeDML(logger, conn, query, []);
                    if (rows && rows.length > 0 && rows[0][label] > 0) {
                        // console.log(rows[0][label]);
                        results.rows = results.rows.concat(rows);
                    }
                }
                catch (err) {
                    results.error = err;
                    console.error(results.error);
                    return results;
                }
            }
        }
        return results;
    });
}
function main(...args) {
    return __awaiter(this, void 0, void 0, function* () {
        const methodName = 'main';
        const logger = bunyan.createLogger({ "name": "ex-mysql" });
        logger.level('error');
        logger.info(`${moduleName}#${methodName}: Starting...`);
        let results;
        const cla = argz(args);
        const tasks = cla.tasks;
        let conn = null;
        try {
            conn = yield sql.connect(logger);
            logger.info(`${moduleName}#${methodName}: Connected...`);
        }
        catch (err) {
            logger.error(`${moduleName}#${methodName}: ${inspect(err)}`);
        }
        /*
          if (tasks.ids) {
            results = await tablesAndIDColumns(conn);
            // console.log(results);
            let columnNames: any[];
            columnNames = [];
            let tableName: string;
            tableName = results.results[0].TABLE_NAME;
            const tables: Map<string, string[]> = new Map();
            for (const result of results.results) {
              if (tableName !== result.TABLE_NAME) {
                tables.set(tableName, columnNames);
                columnNames = [];
                tableName = result.TABLE_NAME;
              }
              columnNames.push(result.COLUMN_NAME);
            }
            tables.set(tableName, columnNames);
        
            // console.log(tables);
        
            results = await ids(conn, tables);
            const keys: any[] = Array.from(results.ids.keys());
            keys.sort();
            // console.log(results);
            for (const key of keys) {
              // console.error(`id=${id.toString()}`);
              const values: any[] = Array.from(results.ids.get(key).values());
              values.sort();
              for (const value of values) {
                // console.error(`value=${value.toString()}`);
                console.log(`${key}\t${value}`);
              }
            }
          }
        */
        if (tasks.counts) {
            console.log(`CATALOG.SCHEMA.TABLE\tCOUNT`);
            results = yield databases(logger, conn);
            const tableCatalogs = [];
            for (const result of results) {
                tableCatalogs.push(result.name);
            }
            for (const tableCatalog of tableCatalogs) {
                results = yield sql.executeDML(logger, conn, `use ${tableCatalog}`, []);
                results = yield tablesAndColumns(logger, conn);
                // console.log(results);
                // process.exit(1);
                let columnNames;
                columnNames = [];
                let tableName;
                tableName = `${tableCatalog}.${results[0].TABLE_SCHEMA}.${results[0].TABLE_NAME}`;
                const tables = new Map();
                for (const result of results) {
                    if (tableName !== result.TABLE_NAME) {
                        tables.set(tableName, columnNames);
                        columnNames = [];
                        tableName = `${tableCatalog}.${result.TABLE_SCHEMA}.${result.TABLE_NAME}`;
                    }
                    columnNames.push(result.COLUMN_NAME);
                }
                tables.set(tableName, columnNames);
                results = yield counts(logger, conn, tables);
                // console.log(results);
                // process.exit(1);
                for (const property in results.tables) {
                    if (results.tables.hasOwnProperty(property)) {
                        console.log(`${property}\t${results.tables[property]}`);
                    }
                }
            }
        }
        if (tasks.descs) {
            results = yield databases(logger, conn);
            const tableCatalogs = [];
            for (const result of results) {
                tableCatalogs.push(result.name);
            }
            for (const tableCatalog of tableCatalogs) {
                console.error(`\nselect '${tableCatalog}' TABLE_CATALOG;\n`);
                console.error(`\nuse ${tableCatalog};\n`);
                results = yield sql.executeDML(logger, conn, `use ${tableCatalog}`, []);
                results = yield tablesAndColumns(logger, conn);
                // console.log(results);
                // process.exit(1);
                let columnNames;
                columnNames = [];
                let tableName;
                tableName = `${tableCatalog}.${results[0].TABLE_SCHEMA}.${results[0].TABLE_NAME}`;
                const tables = new Map();
                for (const result of results) {
                    if (tableName !== result.TABLE_NAME) {
                        tables.set(tableName, columnNames);
                        columnNames = [];
                        tableName = `${tableCatalog}.${result.TABLE_SCHEMA}.${result.TABLE_NAME}`;
                    }
                    columnNames.push(result.COLUMN_NAME);
                }
                tables.set(tableName, columnNames);
                results = yield descs(logger, conn, tables);
            }
        }
        if (tasks.histograms) {
            console.log(`CATALOG.SCHEMA.TABLE\tCOLUMN\tROW\tVALUE\tCOUNT`);
            try {
                results = yield databases(logger, conn);
                logger.info(`${moduleName}#${methodName}: databases ${inspect(results)}`);
            }
            catch (err) {
                logger.info(`${moduleName}#${methodName}: databases error=${inspect(err)}`);
                process.exit(99);
            }
            const tableCatalogs = [];
            for (const result of results) {
                tableCatalogs.push(result.name);
            }
            for (const tableCatalog of tableCatalogs) {
                results = yield sql.executeDML(logger, conn, `use ${tableCatalog}`, []);
                results = yield tablesAndColumns(logger, conn);
                let columnNames = [];
                let tableName = formatTableName(tableCatalog, results[0].TABLE_SCHEMA, results[0].TABLE_NAME);
                const tables = new Map();
                for (const result of results) {
                    if (tableName !== formatTableName(tableCatalog, result.TABLE_SCHEMA, result.TABLE_NAME)) {
                        tables.set(tableName, columnNames);
                        columnNames = [];
                        tableName = formatTableName(tableCatalog, result.TABLE_SCHEMA, result.TABLE_NAME);
                    }
                    columnNames.push(result.COLUMN_NAME);
                }
                tables.set(tableName, columnNames);
                results = yield histograms(logger, conn, tables);
                // console.log(inspect(results));
                // process.exit(1);
                for (const property in results.tables) {
                    // console.log(`* ${property}`);
                    if (results.tables.hasOwnProperty(property)) {
                        const tableName = property;
                        let columnName = '';
                        let columnValue = '';
                        let count = '';
                        let rowCount = 0;
                        let lastColumnName = '';
                        for (const row of results.tables[property]) {
                            // console.log(`** ${inspect(row)}`);
                            let property2Count = 0;
                            for (const property2 in row) {
                                // console.log(`*** ${property2}, i=${i}`);
                                if (row.hasOwnProperty(property2)) {
                                    property2Count++;
                                    if (property2Count === 1) {
                                        columnName = property2;
                                        if (rowCount === 0) {
                                            lastColumnName = columnName;
                                        }
                                        columnValue = row[property2];
                                        if (lastColumnName !== columnName) {
                                            lastColumnName = columnName;
                                            rowCount = 0;
                                        }
                                        rowCount++;
                                    }
                                    else if (property2Count === 2) {
                                        count = row[property2];
                                    }
                                }
                            }
                            console.log(`${tableName}\t${columnName}\t${rowCount}\t${columnValue}\t${count}`);
                        }
                    }
                }
            }
        }
        if (tasks.search) {
            console.log(`CATALOG.SCHEMA.TABLE.COLUMN\tCOUNT`);
            results = yield databases(logger, conn);
            const tableCatalogs = [];
            for (const result of results) {
                tableCatalogs.push(result.name);
            }
            for (const tableCatalog of tableCatalogs) {
                results = yield sql.executeDML(logger, conn, `use ${tableCatalog}`, []);
                // results = await tablesAndStringColumns(logger, conn);
                results = yield tablesAndColumns(logger, conn);
                let columnNames = [];
                let tableName = formatTableName(tableCatalog, results[0].TABLE_SCHEMA, results[0].TABLE_NAME);
                const tables = new Map();
                for (const result of results) {
                    if (tableName !== formatTableName(tableCatalog, result.TABLE_SCHEMA, result.TABLE_NAME)) {
                        tables.set(tableName, columnNames);
                        columnNames = [];
                        tableName = formatTableName(tableCatalog, result.TABLE_SCHEMA, result.TABLE_NAME);
                    }
                    columnNames.push(result.COLUMN_NAME);
                }
                tables.set(tableName, columnNames);
                // console.log(tables);
                // console.error(cla);
                //      const localSearch: string = cla.search && cla.search.toLowerCase ? cla.search.toLowerCase() : '';
                let localSearch = cla.search;
                if (localSearch.trim) {
                    localSearch = localSearch.trim();
                }
                results = yield search(logger, conn, tables, localSearch, cla.like);
                // console.log(results);
                for (const row of results.rows) {
                    let str = ``;
                    for (const col in row) {
                        str += `${col}\t${row[col]}\t`;
                    }
                    console.log(str);
                }
                // break;
            }
        }
        conn.close();
    });
}
exports.default = main;
// Start the program
if (require.main === module) {
    main();
}
function formatTableName(catalog, schema, table) {
    return `${catalog}.${schema}.${table}`;
}
/* https://docs.microsoft.com/en-us/previous-versions/sql/sql-server-2008/ms190785%28v%3dsql.100%29
[ { name: 'dbo', schema_id: '1', principal_id: '1' },
  { name: 'guest', schema_id: '2', principal_id: '2' },
  { name: 'INFORMATION_SCHEMA', schema_id: '3', principal_id: '3' },
  { name: 'sys', schema_id: '4', principal_id: '4' },
  { name: 'db_owner', schema_id: '16384', principal_id: '16384' },
  { name: 'db_accessadmin',
    schema_id: '16385',
    principal_id: '16385' },
  { name: 'db_securityadmin',
    schema_id: '16386',select
    principal_id: '16386' },
  { name: 'db_ddladmin',
    schema_id: '16387',
    principal_id: '16387' },
  { name: 'db_backupoperator',
    schema_id: '16389',
    principal_id: '16389' },
  { name: 'db_datareader',
    schema_id: '16390',
    principal_id: '16390' },
  { name: 'db_datawriter',
    schema_id: '16391',
    principal_id: '16391' },
  { name: 'db_denydatareader',
    schema_id: '16392',
    principal_id: '16392' },
  { name: 'db_denydatawriter',
    schema_id: '16393',
    principal_id: '16393' } ]
  query = 'select * from sys.schemas';
  
  query = 'use PIM_MAIN;';

    query = 'select @@VERSION;';
    
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    
    query = 'select db_name();';
    
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    
    query = 'select current_user;';
    
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    
    query = `select * from sys.fn_my_permissions(NULL, 'SERVER');`;
    
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    
    query = `select * from sys.fn_my_permissions(NULL, 'DATABASE');`;
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    
    query = `SELECT HAS_PERMS_BY_NAME(db_name(), 'DATABASE', 'ANY');`;
    query = `
SELECT db_name(),p.name as UserName, p.type_desc as TypeOfLogin, pp.name as PermissionLevel, pp.type_desc as TypeOfRole
FROM sys.database_role_members roles
JOIN sys.database_principals p ON roles.member_principal_id = p.principal_id
JOIN sys.database_principals pp ON roles.role_principal_id = pp.principal_id
where p.name = current_user
`;
    query =
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    query = `
    select TABLE_NAME,
           COLUMN_NAME
    from   INFORMATION_SCHEMA.COLUMNS
    order by 1, 2
  `;
    query = `select TABLE_CATALOG, count(1) OCCURS from INFORMATION_SCHEMA.TABLES group by TABLE_CATALOG`;
    results = await sql.executeDML(logger, conn, query, []);
    console.log(results);
    results = await sql.executeDML(logger, conn, 'sp_help "INFORMATION_SCHEMA.COLUMNS";', []);
    console.log(results);

*/ 
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsV0FBVzs7Ozs7Ozs7OztBQUVYLGlDQUFpQztBQUVqQyx5QkFBeUI7QUFDekIscUNBQXFDO0FBRXJDLDZCQUE2QjtBQUU3Qiw2QkFBNkI7QUFFN0IsSUFBSSxNQUFjLENBQUM7QUFDbkIsTUFBTSxVQUFVLEdBQVcsT0FBTyxDQUFDO0FBQ25DLE1BQU0sYUFBYSxHQUFVO0lBQzNCLFFBQVE7SUFDUixPQUFPO0lBQ1AsWUFBWTtJQUNaLFFBQVE7Q0FDVCxDQUFDO0FBRUYsOERBQThEO0FBQzlELGlCQUFpQixHQUFRLEVBQUUsUUFBZ0IsQ0FBQztJQUMxQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDL0MsQ0FBQztBQUVELGNBQWMsT0FBWSxJQUFJO0lBQzVCLE1BQU0sVUFBVSxHQUFXLE1BQU0sQ0FBQztJQUVsQyw2REFBNkQ7SUFDN0QsaUNBQWlDO0lBQ2pDLGlEQUFpRDtJQUVqRCxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ2pGLEtBQUssRUFBRTtZQUNMLENBQUMsRUFBRSxNQUFNO1lBQ1QsQ0FBQyxFQUFFLE1BQU07WUFDVCxDQUFDLEVBQUUsV0FBVztZQUNkLENBQUMsRUFBRSxRQUFRO1lBQ1gsQ0FBQyxFQUFFLE9BQU87WUFDVixDQUFDLEVBQUUsU0FBUztTQUNiO1FBQ0QsT0FBTyxFQUFFO1lBQ1AsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO1NBQzNCO0tBQ0YsQ0FBQyxDQUFDO0lBQ0gsTUFB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