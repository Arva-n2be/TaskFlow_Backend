const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.PROJECT_KEY,
    process.env.SERVICE_ROLE_KEY
);

// Pengecekan koneksi awal
supabase.rpc('execute_raw_sql', { sql_query: 'SELECT 1' })
    .then(() => console.log('Database PostgreSQL Supabase (via SDK API Key) berhasil terkoneksi!'))
    .catch((err) => console.error('Koneksi database PostgreSQL Supabase gagal:', err.message));

const escapeValue = (val) => {
    if (val === null || val === undefined) return 'NULL';
    if (val instanceof Date) return `'${val.toISOString()}'`;
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        return `'${val.replace(/'/g, "''")}'`;
    }
    if (Array.isArray(val) || typeof val === 'object') {
        const jsonStr = JSON.stringify(val);
        return `'${jsonStr.replace(/'/g, "''")}'::jsonb`;
    }
    return `'${String(val).replace(/'/g, "''")}'`;
};

const formatSQL = (sql, params = []) => {
    let formattedSql = sql.replace(/`/g, '');
    
    // Konversi fungsi JSON MySQL ke PostgreSQL agar tidak error di Supabase
    formattedSql = formattedSql.replace(/JSON_ARRAYAGG/gi, 'jsonb_agg');
    formattedSql = formattedSql.replace(/JSON_OBJECT/gi, 'jsonb_build_object');

    let paramIdx = 0;
    formattedSql = formattedSql.replace(/\?/g, () => {
        if (paramIdx >= params.length) {
            return '?';
        }
        return escapeValue(params[paramIdx++]);
    });
    return formattedSql;
};

const db = {
    query: async (sql, params = []) => {
        const trimmedSql = sql.trim();
        const formattedSql = formatSQL(trimmedSql, params);
        
        const isInsert = /^\s*insert\s+into/i.test(formattedSql);
        const isUpdateOrDelete = /^\s*(update|delete)/i.test(formattedSql);
        
        let finalSql = formattedSql;
        if (isInsert && !/returning/i.test(finalSql)) {
            finalSql += ' RETURNING id';
        }

        try {
            const { data, error } = await supabase.rpc('execute_raw_sql', {
                sql_query: finalSql
            });

            if (error) {
                throw error;
            }

            if (isInsert) {
                const insertId = data[0]?.id || null;
                return [{ insertId, affectedRows: data.length }, null];
            } else if (isUpdateOrDelete) {
                return [{ affectedRows: 1 }, null];
            } else {
                return [data || [], null];
            }
        } catch (error) {
            console.error('Database query error (Supabase RPC):', error, 'SQL:', finalSql);
            throw error;
        }
    }
};

module.exports = db;