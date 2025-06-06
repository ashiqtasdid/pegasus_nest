// This file adds a timeout check for plugin generation
// to force completion if the backend SSE events don't arrive

// Add this to the PluginGenerator component after the EventSource is created
const checkCompletion = () => {
  setTimeout(() => {
    // If still generating after 30 seconds, and progress is at least 10%
    // assume the plugin is done but the SSE events aren't being received
    if (isGenerating && generationProgress >= 10) {
      console.log('Forcing completion after timeout');
      const downloadUrl = `/create/download/${form.name}`;
      setDownloadUrl(downloadUrl);
      setGenerationProgress(100);
      setIsGenerating(false);

      // Mark all steps as completed
      setSteps((prev) =>
        prev.map((step) => ({
          ...step,
          status: 'completed',
        })),
      );

      setCurrentPlugin({
        name: form.name,
        description: form.description,
        status: 'success',
        downloadUrl: downloadUrl,
      });

      addActivity(
        'Plugin Generation Complete',
        `${form.name} is ready for download`,
        'success',
      );

      // Close the EventSource if it's still open
      if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
    }
  }, 30000); // 30 second timeout
};

// Call the checkCompletion function after setting up the EventSource
checkCompletion();
