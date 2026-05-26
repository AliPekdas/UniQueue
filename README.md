## How to Run

### 1. Prerequisites
- **Node.js**: v18 or higher.
- **SQL Server**: Ensure you have Microsoft SQL Server installed and running locally.

### 2. Database Setup
1. Open SQL Server Management Studio (SSMS) or your preferred SQL client.
2. Connect to your local SQL Server instance.
3. Open and run the **`database/init.sql`** file. This script will automatically:
   - Create the `UniQueueDB` database.
   - Create all necessary tables.
   - Insert sample users (admin, students, lecturers, bus drivers) and sample data.

### 3. Environment Configuration
Create a file named **`.env`** in the root of the project. You can copy the following template and adjust the `DB_PASSWORD` and `JWT_SECRET`:

```env
PORT=3000
DB_SERVER=localhost
DB_DATABASE=UniQueueDB
DB_USER=sa
DB_PASSWORD=your_sql_server_password_here
DB_PORT=1433
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
JWT_SECRET=your_jwt_secret_here
```
*(Note: If you have a different SQL Server user or port, update them accordingly.)*

### 4. Installation
Open a terminal in the project folder (`UniQueue_src`) and install the Node.js dependencies:

```bash
npm install
```

### 5. Running the Application
Start the backend server:

```bash
npm start
```
*(For development with auto-restart, use `npm run dev` instead).*

### 6. Access the Application
Once the server is running, open your web browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

You can log in using any of the sample accounts created by the `init.sql` script.

Sample email and passwords:
alipekdas@marun.edu.tr ➔ alipekdas
ebubekirbagdas@marun.edu.tr ➔ ebubekirbagdas
ilkerelgin@marun.edu.tr ➔ ilkerelgin
dogukansahin@marun.edu.tr ➔ dogukansahin
borahantumer@marmara.edu.tr ➔ borahantumer
mehmetkaya@marmara.edu.tr ➔ mehmetkaya
busdriver1@iett.istanbul ➔ busdriver1
busdriver2@iett.istanbul ➔ busdriver2
admin@uniqueue.com ➔ admin