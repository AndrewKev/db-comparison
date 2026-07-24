# Oracle Lens — Oracle View Script Comparison

Oracle Lens adalah aplikasi web untuk mengambil definisi DDL sebuah view dari dua
Oracle Database lalu membandingkan script SQL keduanya melalui diff editor dua sisi.
DDL diambil dengan `DBMS_METADATA.GET_DDL`; connection string hanya berada dalam
memori halaman dan request API selama sesi.

## Fitur

- Dua koneksi Oracle independen: **Source A** dan **Source B**
- Field `Schema Name` dan `View Name` terpisah
- Test connection dan load view script untuk setiap source
- Monaco SQL Editor read-only dengan line number, copy, dan normalisasi whitespace
- Monaco Diff Editor untuk menunjukkan baris sama, berubah, ditambah, dan dihapus
- Transfer per blok perubahan seperti VS Code melalui panah pada gutter tengah
- Arah penerapan `A → B` atau `B → A` dengan target editor yang dapat diedit
- Navigasi Previous/Next Change
- Comparison otomatis setelah kedua script berhasil dimuat
- Swap Sources dan Clear Comparison
- Validasi allowlist identifier Oracle 11g
- Schema dan view dikirim sebagai bind parameter
- Query timeout, batas panjang script, request, dan response
- Global exception handler tanpa stack trace atau credential
- Dockerfile backend/frontend dan Docker Compose
- Unit test backend dan frontend

## Teknologi

| Area | Teknologi |
| --- | --- |
| Backend | ASP.NET Core Web API, .NET 8 |
| Oracle provider | `Oracle.ManagedDataAccess.Core` 3.21.110 |
| Frontend | React 18, TypeScript, Vite 5 |
| Editor | Monaco Editor / Monaco Diff Editor |
| Styling | CSS Modules |
| Test | xUnit, Vitest, Testing Library |
| Container | Docker, Nginx |

Monaco dan SQL language support dibundel lokal sehingga editor tidak memerlukan CDN
saat aplikasi dijalankan.

## Prasyarat

- .NET SDK 8.x
- Node.js 20+ dan npm 10+
- Akses jaringan dari backend ke Oracle Database 11g
- Akun Oracle yang dapat menjalankan `DBMS_METADATA.GET_DDL`
- Docker Engine dan Docker Compose jika menggunakan container

Untuk view milik schema lain, akun koneksi harus mempunyai privilege metadata yang
sesuai. Oracle dapat mengembalikan error yang sama untuk object yang tidak ditemukan
dan object yang metadata-nya tidak dapat diakses.

## Menjalankan secara lokal

### Backend

```bash
cd backend
dotnet restore
dotnet build
dotnet run --project OracleComparison.Api --urls http://localhost:5000
```

Swagger tersedia di `/swagger` saat `ASPNETCORE_ENVIRONMENT=Development`. Health
endpoint tersedia di `GET /health`.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Buka `http://localhost:5173`.

Isi `.env` frontend:

```env
VITE_API_BASE_URL=http://localhost:5000
```

Variable Vite dibaca saat development server dimulai dan ketika production bundle
dibangun.

## Contoh connection string

```text
User Id=myuser;Password=mypassword;Data Source=hostname:1521/SERVICE_NAME;
```

Contoh descriptor dengan SID:

```text
User Id=myuser;Password=mypassword;Data Source=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=hostname)(PORT=1521))(CONNECT_DATA=(SID=ORCL)));
```

Connection string tidak ditulis ke source code, configuration file, log, database,
`localStorage`, atau `sessionStorage`. Gunakan HTTPS di luar development agar
credential terenkripsi saat transit.

## API

### `POST /api/oracle/test-connection`

Request:

```json
{
  "connectionString": "User Id=myuser;Password=...;Data Source=host:1521/service;"
}
```

Response `200 OK`:

```json
{
  "success": true,
  "message": "Connection successful"
}
```

### `POST /api/oracle/load-view-script`

Request:

```json
{
  "connectionString": "User Id=myuser;Password=...;Data Source=host:1521/service;",
  "schemaName": "MY_SCHEMA",
  "viewName": "MY_VIEW"
}
```

Response `200 OK`:

```json
{
  "success": true,
  "executionTimeMs": 42,
  "schemaName": "MY_SCHEMA",
  "viewName": "MY_VIEW",
  "script": "CREATE OR REPLACE FORCE VIEW \"MY_SCHEMA\".\"MY_VIEW\" AS\nSELECT ..."
}
```

Error menggunakan status yang sesuai (`400`, `413`, `422`, `502`, atau `504`):

```json
{
  "success": false,
  "message": "Pesan aman untuk pengguna",
  "errorCode": "ORACLE_METADATA_FAILED"
}
```

### `GET /health`

Mengembalikan status proses API dan tidak membuka koneksi Oracle pengguna.

## Query metadata Oracle

Backend menjalankan query berikut:

```sql
SELECT DBMS_METADATA.GET_DDL(
    'VIEW',
    :viewName,
    :schemaName
) AS VIEW_SCRIPT
FROM DUAL
```

`viewName` dan `schemaName` selalu menggunakan bind parameter. Sebelum binding,
keduanya harus lolos allowlist identifier:

- Diawali huruf ASCII
- Selanjutnya hanya huruf, angka, `_`, `$`, atau `#`
- Maksimal 30 karakter sesuai batas unquoted identifier Oracle 11g
- Quoted/mixed-case identifier, dot, whitespace, dan ekspresi SQL ditolak
- Nilai dinormalisasi ke uppercase

Hasil `DBMS_METADATA.GET_DDL` berupa CLOB. Backend membaca CLOB hanya jika panjangnya
berada di bawah batas konfigurasi, menormalisasi line ending, dan mengembalikan SQL
sebagai string.

## Konfigurasi backend

Konfigurasi berada di
`backend/OracleComparison.Api/appsettings.json` dan dapat dioverride dengan
environment variable ASP.NET Core.

| Key | Default | Fungsi |
| --- | ---: | --- |
| `OracleComparison:AllowedCorsOrigin` | `http://localhost:5173` | Origin frontend |
| `OracleComparison:QueryTimeoutSeconds` | 60 | Timeout metadata query |
| `OracleComparison:MaximumViewScriptLength` | 1000000 | Maksimum karakter DDL |
| `OracleComparison:MaximumResponseSizeBytes` | 10485760 | Maksimum response JSON |
| `OracleComparison:MaximumRequestSizeBytes` | 65536 | Maksimum request body |

Contoh override:

```bash
export OracleComparison__AllowedCorsOrigin=https://oracle-lens.example.com
export OracleComparison__MaximumViewScriptLength=2000000
```

Jangan menambahkan connection string pengguna ke `appsettings*.json`.

## Test dan build

Backend:

```bash
cd backend
dotnet test
dotnet build --configuration Release
```

Frontend:

```bash
cd frontend
npm run test
npm run build
```

Integration test koneksi hanya benar-benar membuka koneksi jika variable berikut
tersedia:

```bash
export ORACLE_TEST_CONNECTION_STRING='User Id=...;Password=...;Data Source=...;'
dotnet test
```

Tanpa variable tersebut, test koneksi Oracle nyata tidak dijalankan.

## Docker

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

Container Oracle tidak disediakan. Container backend harus dapat merutekan koneksi
ke hostname Oracle yang dimasukkan pengguna.

## Struktur folder

```text
.
├── backend/
│   ├── OracleComparison.Api/
│   │   ├── Controllers/
│   │   ├── DTOs/
│   │   ├── Exceptions/
│   │   ├── Models/
│   │   ├── Services/
│   │   ├── Validators/
│   │   ├── Program.cs
│   │   └── Dockerfile
│   ├── OracleComparison.Tests/
│   └── OracleComparison.sln
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── models/
│   │   ├── pages/
│   │   ├── test/
│   │   └── utils/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Keamanan

- API tidak mencatat request body atau connection string.
- Password field disamarkan dan browser autocomplete dimatikan.
- Connection string hanya disimpan pada React state.
- Schema dan view divalidasi lalu dikirim sebagai bind parameter.
- CORS hanya mengizinkan origin yang dikonfigurasi.
- Exception internal dan stack trace tidak dikirim ke browser.
- Panjang CLOB dan ukuran response dibatasi.
- Tidak ada connection string pengguna dalam configuration atau image Docker.

Browser devtools dan infrastructure proxy masih dapat menginspeksi request. Gunakan
HTTPS, akun Oracle read-only, access control aplikasi, dan nonaktifkan body logging
pada reverse proxy/APM.

## Troubleshooting

### Unable to connect to Oracle database

- Periksa hostname, port, service name/SID, firewall, DNS, dan credential.
- Coba descriptor penuh bila service shorthand tidak sesuai.
- Verifikasi kebutuhan encryption atau authentication database.

### ORACLE_METADATA_FAILED

- Pastikan schema dan view benar.
- Pastikan akun dapat mengakses metadata view tersebut.
- Untuk object schema lain, berikan privilege catalog/object yang benar sesuai
  kebijakan database.

### Diff berbeda hanya karena format

- Gunakan tombol **Normalize SQL** pada kedua source.
- Normalisasi hanya mengubah line ending, trailing whitespace, dan whitespace luar;
  keyword atau struktur SQL tidak ditulis ulang.
- `DBMS_METADATA` dapat menghasilkan atribut berbeda pada versi atau konfigurasi
  Oracle yang berbeda.

### Menerapkan perubahan dari satu source ke source lain

1. Muat script Source A dan Source B.
2. Pilih **A → B** bila Source B menjadi target, atau **B → A** bila Source A menjadi
   target.
3. Arah kiri adalah reference dan arah kanan adalah editable target.
4. Arahkan pointer ke blok perubahan, lalu klik ikon panah pada gutter tengah untuk
   menerapkan blok tersebut ke target.
5. Gunakan **Previous** dan **Next** untuk berpindah antarblok perubahan.

Perubahan pada target langsung disimpan ke state aplikasi dan terlihat juga pada
editor source. Perubahan ini hanya berada dalam memori browser; aplikasi tidak
menulis ulang view ke Oracle Database.

### CORS error

- Samakan origin browser dengan `AllowedCorsOrigin`, termasuk scheme dan port.
- Restart backend setelah mengubah configuration.

### Script terlalu besar

- Naikkan `MaximumViewScriptLength` dan `MaximumResponseSizeBytes` secara terukur.
- Perhatikan dampak memory dan waktu render Monaco.

## Batasan

- Hanya metadata object bertipe `VIEW` yang didukung.
- Schema dan view wajib dimasukkan terpisah.
- Quoted atau case-sensitive Oracle identifier tidak didukung.
- Diff membandingkan teks SQL, bukan semantic SQL/AST.
- Privilege, authentication, TLS, dan patch-set Oracle 11g perlu diverifikasi pada
  database target.
