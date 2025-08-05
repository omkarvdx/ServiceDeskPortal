export const getUserFriendlyText = (technical) => {
  const mappings = {
    'Resolver Group': 'Support Team',
    'BU Number': 'Department',
    'Request Type': 'Type',
    'SLA': 'Priority',
    'CTI Record': 'Category',
    'AI Prediction': 'Automatic Assignment',
    'Classification': 'Category'
  };
  return mappings[technical] || technical;
};
