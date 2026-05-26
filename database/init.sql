CREATE DATABASE UniQueueDB;
GO

USE UniQueueDB;
GO

CREATE TABLE Users (
    userID INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    email NVARCHAR(100) UNIQUE NOT NULL,
    passwordHash NVARCHAR(255) NOT NULL,
    role NVARCHAR(20) NOT NULL,
    CONSTRAINT CHK_UserRole CHECK (role IN ('Student', 'Lecturer', 'BusDriver', 'Admin'))
);
GO

CREATE TABLE Resources (
    resourceID INT IDENTITY(1,1) PRIMARY KEY,
    resourceName NVARCHAR(100) NOT NULL,
    resourceType NVARCHAR(20) NOT NULL,
    scheduleInfo NVARCHAR(500) NULL,
    maxCapacity INT NOT NULL,
    currentCapacity INT NOT NULL,
    status NVARCHAR(20) NOT NULL,
    ownerUserID INT NOT NULL,
    CONSTRAINT CHK_ResourceType CHECK (resourceType IN ('StudyRoom', 'OfficeHours', 'TransitLine')),
    CONSTRAINT CHK_ResourceStatus CHECK (status IN ('Available', 'Full', 'OutOfService')),
    CONSTRAINT FK_Resources_Owner FOREIGN KEY (ownerUserID) REFERENCES Users(userID)
);
GO

CREATE TABLE Reservations (
    reservationID INT IDENTITY(1,1) PRIMARY KEY,
    userID INT NOT NULL,
    resourceID INT NOT NULL,
    timestamp DATETIME2 DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status NVARCHAR(20) NOT NULL,
    CONSTRAINT FK_Reservations_Users FOREIGN KEY (userID) REFERENCES Users(userID),
    CONSTRAINT FK_Reservations_Resources FOREIGN KEY (resourceID) REFERENCES Resources(resourceID) ON DELETE CASCADE,
    CONSTRAINT CHK_ReservationStatus CHECK (status IN ('Booked', 'Waitlisted', 'Canceled'))
);
GO

CREATE TABLE Notifications (
    notificationID INT IDENTITY(1,1) PRIMARY KEY,
    userID INT NOT NULL,
    type NVARCHAR(40) NOT NULL,
    message NVARCHAR(500) NOT NULL,
    isRead BIT NOT NULL DEFAULT 0,
    createdAt DATETIME2 DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT FK_Notifications_Users FOREIGN KEY (userID) REFERENCES Users(userID)
);
GO

CREATE NONCLUSTERED INDEX IX_Reservations_QueuePromotion
ON Reservations (resourceID, status, timestamp)
INCLUDE (userID);
GO

INSERT INTO Users (name, email, passwordHash, role) VALUES
(N'Ali Doğan Pekdaş', N'alipekdas@marun.edu.tr', N'$2b$10$KT3WDnFH6PTt9AnAjkgpseDAluyKpbXceU0Qc8R3DYkOO4zp7Fj2q', N'Student'),
(N'Ebubekir Bağdaş', N'ebubekirbagdas@marun.edu.tr', N'$2b$10$1xDg62hpNmrDs9w1Oi0Mke.yBu0o5A/JDaFmMGY4vsnsBaHJc8uzq', N'Student'),
(N'İlker Elgin', N'ilkerelgin@marun.edu.tr', N'$2b$10$DKZV33KahmF.U8Gj/828LehPKXljkK1WIyMACceVMCIX3he9mFr46', N'Student'),
(N'Doğukan Şahin', N'dogukansahin@marun.edu.tr', N'$2b$10$cq3ycwqHN0etelU/7SmZT.KblhWOsAC8PQPXNtAV8ySRLqKqtj3N6', N'Student'),
(N'Prof. Dr. Borahan Tümer', N'borahantumer@marmara.edu.tr', N'$2b$10$BrKW0mi2rD5yDvSnUXqx4uLmlv3X9F9nyDad5cch21.3avsNOegEe', N'Lecturer'),
(N'Res. Asst. Mehmet Kaya', N'mehmetkaya@marmara.edu.tr', N'$2b$10$surj3mjE7xwE6cC6dlzp5.YlUia8qnO/cW9zgOMfZG3mifB54enn6', N'Lecturer'),
(N'Bus Driver1', N'busdriver1@iett.istanbul', N'$2b$10$lZCbCo5V03WJpLyxOaZcRecEc9HadAjOYzmSJ.ELlhBjI6Hnt59lS', N'BusDriver'),
(N'Bus Driver2', N'busdriver2@iett.istanbul', N'$2b$10$CDtbvaaDYX7wp7eml3PT7e9XHkFdSN5qTTnk94vEyke6/sFcKrj36', N'BusDriver'),
(N'Administrator', N'admin@uniqueue.com', N'$2b$10$X5j4AsU9O5qkM.2lXUW4gOLMtQ.CFgXAMUWuPW5EnuOMiTIiU9Pbe', N'Admin');
GO

INSERT INTO Resources (resourceName, resourceType, scheduleInfo, maxCapacity, currentCapacity, status, ownerUserID)
SELECT N'Study Room - M1 1st Floor', N'StudyRoom', NULL, 1, 0, N'Available', userID FROM Users WHERE email = N'admin@uniqueue.com'
UNION ALL SELECT N'Study Room - M1 2nd Floor', N'StudyRoom', NULL, 20, 0, N'Available', userID FROM Users WHERE email = N'admin@uniqueue.com'
UNION ALL SELECT N'Study Room - M2 1st Floor', N'StudyRoom', NULL, 20, 0, N'Available', userID FROM Users WHERE email = N'admin@uniqueue.com'
UNION ALL SELECT N'Office Hours - Prof. Dr. Borahan Tümer', N'OfficeHours', NULL, 1, 0, N'Available', userID FROM Users WHERE email = N'borahantumer@marmara.edu.tr'
UNION ALL SELECT N'Office Hours - Res. Asst. Mehmet Kaya', N'OfficeHours', NULL, 5, 0, N'Available', userID FROM Users WHERE email = N'mehmetkaya@marmara.edu.tr'
UNION ALL SELECT N'KM41 University-Metro', N'TransitLine', N'Mon–Fri 06:00–22:00 · Every 10 min', 0, 0, N'Available', userID FROM Users WHERE email = N'busdriver1@iett.istanbul'
UNION ALL SELECT N'KM41-1 University-Dormitory', N'TransitLine', N'Mon–Sat 06:30–19:40 · Every 25 min', 0, 0, N'Available', userID FROM Users WHERE email = N'busdriver2@iett.istanbul';
GO
