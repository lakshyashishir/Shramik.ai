@description(''Deployment location'')
param location string = resourceGroup().location

@description(''Short environment name, such as dev or hack'')
param environmentName string = ''hack''

@description(''Storage account name'')
param storageAccountName string

@description(''Key Vault name'')
param keyVaultName string

@description(''Container Apps environment name'')
param containerAppsEnvironmentName string

resource storage ''Microsoft.Storage/storageAccounts@2023-05-01'' = {
  name: storageAccountName
  location: location
  sku: {
    name: ''Standard_LRS''
  }
  kind: ''StorageV2''
  properties: {
    minimumTlsVersion: ''TLS1_2''
    supportsHttpsTrafficOnly: true
  }
}

resource keyVault ''Microsoft.KeyVault/vaults@2023-07-01'' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: ''A''
      name: ''standard''
    }
    enableRbacAuthorization: true
  }
}

resource logAnalytics ''Microsoft.OperationalInsights/workspaces@2023-09-01'' = {
  name: ''log-${environmentName}-shramik''
  location: location
  properties: {
    retentionInDays: 30
  }
}

resource containerAppsEnv ''Microsoft.App/managedEnvironments@2024-03-01'' = {
  name: containerAppsEnvironmentName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: ''log-analytics''
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

output storageAccountId string = storage.id
output keyVaultId string = keyVault.id
output containerAppsEnvironmentId string = containerAppsEnv.id
