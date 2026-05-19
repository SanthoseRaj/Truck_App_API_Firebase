const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Truck Tracking Backend API',
      version: '1.0.0',
      description:
        'API documentation for Truck Tracking and Destination Management App. Login first, copy the token, click Authorize, and paste it as: Bearer <token>.',
    },
    servers: [
      {
        url: process.env.SWAGGER_SERVER_URL || 'http://127.0.0.1:5001/truckapp-api/us-central1/api',
        description: 'Firebase Functions emulator',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste your JWT token here. You may paste only the token; Swagger will send it as Bearer <token>.',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'Owner' },
            username: { type: 'string', example: 'owner' },
            mobileNumber: { type: 'string', example: '+971500000000' },
            role: {
              type: 'string',
              enum: ['owner', 'admin', 'yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'],
            },
            assignedStop: { type: 'string', enum: ['yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'] },
            entryTeam: {
              $ref: '#/components/schemas/EntryTeam',
            },
          },
        },
        EntryTeam: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              enum: ['yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'],
              example: 'yard',
            },
            name: { type: 'string', example: 'Yard Entry Team' },
            stop: {
              type: 'string',
              enum: ['Yard', 'Gate', 'Port Loading', 'Custom Clearence', 'Dubai', 'Free Zone'],
              example: 'Yard',
            },
            role: {
              type: 'string',
              enum: ['yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'],
              example: 'yard',
            },
            assignedStop: {
              type: 'string',
              enum: ['yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'],
              example: 'yard',
            },
            order: { type: 'number', example: 1 },
            lat: { type: 'number', example: 25.2048 },
            lng: { type: 'number', example: 55.2708 },
          },
        },
        CreateAdminInput: {
          type: 'object',
          required: ['name', 'mobileNumber', 'username', 'password'],
          properties: {
            name: { type: 'string', example: 'Site Admin' },
            mobileNumber: { type: 'string', example: '+971500000001' },
            username: { type: 'string', example: 'siteadmin' },
            password: { type: 'string', minLength: 6, example: '123456' },
          },
        },
        CreateMemberInput: {
          type: 'object',
          required: ['entryTeamId', 'name', 'mobileNumber', 'username', 'password'],
          properties: {
            entryTeamId: {
              type: 'string',
              enum: ['yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'],
              example: 'yard',
            },
            entryTeamName: { type: 'string', example: 'Yard Entry Team' },
            entryTeamStop: {
              type: 'string',
              enum: ['Yard', 'Gate', 'Port Loading', 'Custom Clearence', 'Dubai', 'Free Zone'],
              example: 'Yard',
            },
            assignedStop: {
              type: 'string',
              enum: ['yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'],
              example: 'yard',
            },
            name: { type: 'string', example: 'Yard Member' },
            mobileNumber: { type: 'string', example: '+971500000002' },
            username: { type: 'string', example: 'yardmember1' },
            password: { type: 'string', minLength: 6, example: '123456' },
          },
        },
        UpdateMemberInput: {
          type: 'object',
          properties: {
            entryTeamId: {
              type: 'string',
              enum: ['yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'],
              example: 'yard',
            },
            entryTeamName: { type: 'string', example: 'Yard Entry Team' },
            entryTeamStop: {
              type: 'string',
              enum: ['Yard', 'Gate', 'Port Loading', 'Custom Clearence', 'Dubai', 'Free Zone'],
              example: 'Yard',
            },
            assignedStop: {
              type: 'string',
              enum: ['yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'],
              example: 'yard',
            },
            name: { type: 'string', example: 'Updated Yard Member' },
            mobileNumber: { type: 'string', example: '+971500000099' },
            username: { type: 'string', example: 'yardmember1' },
            password: { type: 'string', minLength: 6, example: '123456' },
            isActive: { type: 'boolean', example: true },
          },
        },
        Truck: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            headTruckNumber: { type: 'string', example: 'OM-NEW-1001' },
            tailTrailerNumber: { type: 'string', example: 'TRL-1001' },
            truckModel: { type: 'string', enum: ['2 Axle', '3 Axle', '6 Wheel'], example: '6 Wheel' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        TruckInput: {
          type: 'object',
          required: ['headTruckNumber', 'tailTrailerNumber', 'truckModel'],
          properties: {
            headTruckNumber: { type: 'string', example: 'OM-NEW-1001' },
            tailTrailerNumber: { type: 'string', example: 'TRL-NEW-1001' },
            truckModel: { type: 'string', enum: ['2 Axle', '3 Axle', '6 Wheel'], example: '6 Wheel' },
            isActive: { type: 'boolean', example: true },
          },
        },
        TruckUpdateInput: {
          type: 'object',
          properties: {
            headTruckNumber: { type: 'string', example: 'OM-1014' },
            tailTrailerNumber: { type: 'string', example: 'TRL-1002' },
            truckModel: { type: 'string', enum: ['2 Axle', '3 Axle', '6 Wheel'], example: '3 Axle' },
            isActive: { type: 'boolean', example: true },
          },
        },
        Ship: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            shipName: { type: 'string', example: 'MV Midway Spirit' },
            shipNumber: { type: 'string', example: '' },
            quantityOfCargoOnBoard: { type: 'number', example: 30000 },
            eta: { type: 'string', example: '2026-05-14' },
            atb: { type: 'string', example: '2026-05-15' },
            dailyDischargeRate: { type: 'number', example: 5000 },
            etcDays: { type: 'number', nullable: true, example: 6 },
            completionDate: { type: 'string', nullable: true, example: '2026-05-21T00:00:00.000Z' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ShipInput: {
          type: 'object',
          required: ['shipName', 'quantityOfCargoOnBoard', 'eta', 'atb', 'dailyDischargeRate'],
          properties: {
            shipName: { type: 'string', example: 'MV Midway Spirit' },
            shipNumber: { type: 'string', example: '' },
            quantityOfCargoOnBoard: { type: 'number', example: 30000 },
            eta: { type: 'string', example: '2026-05-14' },
            atb: { type: 'string', example: '2026-05-15' },
            dailyDischargeRate: { type: 'number', example: 5000 },
            isActive: { type: 'boolean', example: true },
          },
        },
        Driver: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            driverName: { type: 'string', example: 'Ali Mohammed' },
            mobileNumber: { type: 'string', example: '+96893307711' },
            idNumber: { type: 'string', example: 'ID-11842' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        DriverInput: {
          type: 'object',
          required: ['driverName', 'mobileNumber', 'idNumber'],
          properties: {
            driverName: { type: 'string', example: 'Ali Mohammed' },
            mobileNumber: { type: 'string', example: '+96893307711' },
            idNumber: { type: 'string', example: 'ID-11842' },
            isActive: { type: 'boolean', example: true },
          },
        },
        TruckEntryUpdate: {
          type: 'object',
          properties: {
            stop: { type: 'string', example: 'yard' },
            status: { type: 'string', example: 'entry' },
            updatedAt: { type: 'string', format: 'date-time', example: '2026-05-13T20:27:00.000' },
            crossedAt: { type: 'string', format: 'date-time', example: '2026-05-13T20:27:00.000' },
            entryAt: { type: 'string', format: 'date-time', example: '2026-05-13T20:27:00.000' },
            exitAt: { type: 'string', format: 'date-time', example: '2026-05-13T21:10:00.000' },
            teamName: { type: 'string', example: 'Yard Entry Team' },
            memberName: { type: 'string', example: 'Yard Member' },
            remarks: { type: 'string', example: 'Checked and approved' },
          },
        },
        TruckEntry: {
          type: 'object',
          properties: {
            truckId: { type: 'string', example: 'TRUCK_OBJECT_ID' },
            headTruckNumber: { type: 'string', example: 'OM-TRK-1021' },
            tailTrailerNumber: { type: 'string', example: 'TRL-5821' },
            supplierName: { type: 'string', example: 'Muscat Gulf Logistics' },
            shipId: { type: 'string' },
            shipName: { type: 'string', example: 'MV Gulf Falcon' },
            shipNumber: { type: 'string', example: 'SHIP-1001' },
            tripNumber: { type: 'string', example: 'TRIP-24051' },
            tripTime: { type: 'number', example: 1 },
            driverName: { type: 'string', example: 'Nabil Al Hinai' },
            driverMobile: { type: 'string', example: '+96890011212' },
            driverTdCardNumber: { type: 'string', example: 'ID-88421' },
            truckModel: { type: 'string', enum: ['2 Axle', '3 Axle', '6 Wheel'], example: '6 Wheel' },
            destination: { type: 'string', enum: ['dubai', 'freezone'], example: 'dubai' },
            dubaiFreeZoneDestination: { type: 'string', enum: ['dubai', 'freezone'], example: 'dubai' },
            destinationType: { type: 'string', enum: ['dubai', 'freezone'], example: 'dubai' },
            originStop: { type: 'string', enum: ['yard', 'gate'], example: 'yard' },
            currentStop: {
              type: 'string',
              enum: ['yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'],
              example: 'yard',
            },
            currentStatus: { type: 'string', enum: ['entry', 'exit', 'completed'], example: 'entry' },
            updates: {
              type: 'array',
              items: { $ref: '#/components/schemas/TruckEntryUpdate' },
            },
            currentAllowedRole: {
              type: 'string',
              enum: ['yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'],
              example: 'gate',
            },
            currentAllowedStop: {
              type: 'string',
              enum: ['yard', 'gate', 'port', 'clearence', 'dubai', 'freezone'],
              example: 'gate',
            },
            currentAction: { type: 'string', enum: ['entry', 'exit'], example: 'entry' },
            workflowStatus: { type: 'string', enum: ['pending', 'completed'], example: 'pending' },
            entryAt: { type: 'string', format: 'date-time', example: '2026-05-13T20:27:00.000' },
            exitAt: { type: 'string', format: 'date-time', example: '2026-05-13T21:10:00.000' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        TruckEntryInput: {
          type: 'object',
          required: [
            'truckId',
            'headTruckNumber',
            'tailTrailerNumber',
            'supplierName',
            'shipId',
            'shipName',
            'shipNumber',
            'tripNumber',
            'tripTime',
            'driverName',
            'driverMobile',
            'driverTdCardNumber',
            'truckModel',
            'destination',
          ],
          properties: {
            truckId: { type: 'string', example: 'TRUCK_OBJECT_ID' },
            headTruckNumber: { type: 'string', example: 'OM-TRK-1021' },
            tailTrailerNumber: { type: 'string', example: 'TRL-5821' },
            supplierName: { type: 'string', example: 'Muscat Gulf Logistics' },
            shipId: { type: 'string', example: 'SHIP_OBJECT_ID' },
            shipName: { type: 'string', example: 'MV Gulf Falcon' },
            shipNumber: { type: 'string', example: 'SHIP-1001' },
            tripNumber: { type: 'string', example: 'TRIP-24051' },
            tripTime: { type: 'number', example: 1 },
            driverName: { type: 'string', example: 'Nabil Al Hinai' },
            driverMobile: { type: 'string', example: '+96890011212' },
            driverTdCardNumber: { type: 'string', example: 'ID-88421' },
            truckModel: { type: 'string', enum: ['2 Axle', '3 Axle', '6 Wheel'], example: '6 Wheel' },
            destination: { type: 'string', enum: ['dubai', 'freezone'], example: 'dubai' },
            originStop: { type: 'string', enum: ['yard', 'gate'], example: 'yard' },
            entryAt: { type: 'string', format: 'date-time', example: '2026-05-13T20:27:00.000' },
          },
        },
        TruckEntryTeamUpdateInput: {
          type: 'object',
          properties: {
            entryAt: { type: 'string', format: 'date-time', example: '2026-05-13T20:27:00.000' },
            remarks: { type: 'string', example: 'Gate entry completed' },
          },
        },
        TruckEntryExitUpdateInput: {
          type: 'object',
          properties: {
            exitAt: { type: 'string', format: 'date-time', example: '2026-05-13T21:10:00.000' },
            remarks: { type: 'string', example: 'Gate exit completed' },
          },
        },
        Trip: {
          type: 'object',
          properties: {
            truck: { type: 'string' },
            routeStops: {
              type: 'array',
              items: { type: 'string' },
            },
            currentStop: { type: 'string' },
            nextStop: { type: 'string' },
            status: {
              type: 'string',
              enum: ['waiting', 'entered', 'exited', 'in_transit', 'completed'],
            },
            entryTime: { type: 'string', format: 'date-time' },
            exitTime: { type: 'string', format: 'date-time' },
            startedAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
            remarks: { type: 'string' },
          },
        },
        RemarksInput: {
          type: 'object',
          properties: {
            remarks: { type: 'string', example: 'Checked and approved' },
          },
        },
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./routes/*.js'],
};

module.exports = swaggerJsdoc(swaggerOptions);
