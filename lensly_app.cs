using System;
using System.Diagnostics;
using System.Windows.Forms;
using System.IO;

namespace LenslyApp
{
    public class LenslyLauncher
    {
        [STAThread]
        public static void Main()
        {
            try
            {
                // Check if Desktop shortcut exists to launch with custom AppUserModelID isolation
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                string shortcutPath = Path.Combine(desktopPath, "Lensly.lnk");

                if (File.Exists(shortcutPath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = shortcutPath;
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                    return;
                }

                // Fallback launch via Standalone Chromium App Mode
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "msedge.exe";
                    psi.Arguments = "--app=\"http://localhost:5173/\"";
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                }
                catch
                {
                    try
                    {
                        ProcessStartInfo psi = new ProcessStartInfo();
                        psi.FileName = "chrome.exe";
                        psi.Arguments = "--app=\"http://localhost:5173/\"";
                        psi.UseShellExecute = true;
                        Process.Start(psi);
                    }
                    catch
                    {
                        Process.Start("http://localhost:5173/");
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Launcher error: " + ex.Message);
            }
        }
    }
}
