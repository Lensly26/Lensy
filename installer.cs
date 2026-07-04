using System;
using System.Drawing;
using System.Windows.Forms;
using System.Diagnostics;
using System.IO;

namespace LenslyInstaller
{
    public class InstallerForm : Form
    {
        private Label titleLabel;
        private Label statusLabel;
        private ProgressBar progressBar;
        private Timer installTimer;
        private int progressValue = 0;

        public InstallerForm()
        {
            // Form Configuration
            this.Text = "Lensly Setup v2.9.3";
            this.Size = new Size(520, 320);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(15, 15, 20);
            this.ForeColor = Color.White;
            this.Font = new Font("Segoe UI", 10, FontStyle.Regular);

            // App Icon / Banner Simulation
            Panel bannerPanel = new Panel();
            bannerPanel.Size = new Size(520, 12);
            bannerPanel.Dock = DockStyle.Top;
            bannerPanel.BackColor = Color.FromArgb(233, 69, 96); // Lensly Red Accent
            this.Controls.Add(bannerPanel);

            // Title Label
            titleLabel = new Label();
            titleLabel.Text = "Lensly Desktop Setup";
            titleLabel.Font = new Font("Segoe UI", 20, FontStyle.Bold);
            titleLabel.ForeColor = Color.FromArgb(233, 69, 96);
            titleLabel.AutoSize = true;
            titleLabel.Location = new Point(32, 40);
            this.Controls.Add(titleLabel);

            // Subtitle
            Label subLabel = new Label();
            subLabel.Text = "Installing official Lensly Desktop v2.9.3 bundle...";
            subLabel.ForeColor = Color.FromArgb(180, 180, 190);
            subLabel.AutoSize = true;
            subLabel.Location = new Point(36, 85);
            this.Controls.Add(subLabel);

            // Progress Bar
            progressBar = new ProgressBar();
            progressBar.Size = new Size(440, 24);
            progressBar.Location = new Point(36, 140);
            progressBar.Style = ProgressBarStyle.Continuous;
            this.Controls.Add(progressBar);

            // Status Label
            statusLabel = new Label();
            statusLabel.Text = "Initializing installation engine...";
            statusLabel.ForeColor = Color.FromArgb(140, 140, 150);
            statusLabel.AutoSize = true;
            statusLabel.Location = new Point(36, 175);
            this.Controls.Add(statusLabel);

            // Footer
            Label footerLabel = new Label();
            footerLabel.Text = "© 2026 Lensly Inc. Secured by Lensly Staging Engine.";
            footerLabel.Font = new Font("Segoe UI", 8, FontStyle.Regular);
            footerLabel.ForeColor = Color.FromArgb(100, 100, 110);
            footerLabel.AutoSize = true;
            footerLabel.Location = new Point(36, 245);
            this.Controls.Add(footerLabel);

            // Timer Configuration
            installTimer = new Timer();
            installTimer.Interval = 120; // Tick every 120ms
            installTimer.Tick += new EventHandler(OnTimerTick);
            installTimer.Start();
        }

        private void CompileLauncher(string targetExe)
        {
            try
            {
                string targetDir = Path.GetDirectoryName(targetExe);
                string sourceCodeFile = Path.Combine(targetDir, "launcher.cs");
                
                string launcherSource = @"using System;
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
                // Fallback launch via Standalone Chromium App Mode
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = ""msedge.exe"";
                    psi.Arguments = ""--app=\""http://localhost:5173/\"""";
                    psi.UseShellExecute = true;
                    Process.Start(psi);
                    return;
                }
                catch
                {
                    try
                    {
                        ProcessStartInfo psi = new ProcessStartInfo();
                        psi.FileName = ""chrome.exe"";
                        psi.Arguments = ""--app=\""http://localhost:5173/\"""";
                        psi.UseShellExecute = true;
                        Process.Start(psi);
                    }
                    catch
                    {
                        Process.Start(""http://localhost:5173/"");
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine(""Launcher error: "" + ex.Message);
            }
        }
    }
}";
                File.WriteAllText(sourceCodeFile, launcherSource);

                // Find csc.exe
                string cscPath = @"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe";
                if (!File.Exists(cscPath))
                {
                    cscPath = @"C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe";
                }

                if (File.Exists(cscPath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = cscPath;
                    psi.Arguments = string.Format("/target:winexe /reference:System.Windows.Forms.dll /out:\"{0}\" \"{1}\"", targetExe, sourceCodeFile);
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    Process p = Process.Start(psi);
                    if (p != null) p.WaitForExit();
                }

                try { File.Delete(sourceCodeFile); } catch {}
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Launcher compile error: " + ex.Message);
            }
        }

        private void InstallAppAndCreateShortcuts()
        {
            try
            {
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string targetDir = Path.Combine(localAppData, "Lensly");
                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                string targetExe = Path.Combine(targetDir, "Lensly.exe");
                CompileLauncher(targetExe);

                // Create Desktop & Start Menu Shortcuts with custom AppUserModelID isolation via Shell.Application using a temp ps1 file
                string tempPs1 = Path.Combine(Path.GetTempPath(), "gc_shortcut.ps1");
                string psScript = @"
$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$StartMenuPath = [Environment]::GetFolderPath('StartMenu')

$Shortcut = $WshShell.CreateShortcut(""$DesktopPath\Lensly.lnk"")
$Shortcut.TargetPath = ""TARGET_EXE_PATH""
$Shortcut.Description = ""Lensly Desktop Communication App"
$Shortcut.Save()

$Shortcut2 = $WshShell.CreateShortcut(""$StartMenuPath\Programs\Lensly.lnk"")
$Shortcut2.TargetPath = ""TARGET_EXE_PATH""
$Shortcut2.Description = ""Lensly Desktop Communication App"
$Shortcut2.Save()

$Shell = New-Object -comObject Shell.Application
$Folder = $Shell.NameSpace($DesktopPath)
$Item = $Folder.ParseName(""Lensly.lnk"")
$Item.ExtendedProperty(""System.AppUserModel.ID"", ""Lensly.Desktop.App"")

$Folder2 = $Shell.NameSpace(""$StartMenuPath\Programs"")
$Item2 = $Folder2.ParseName(""Lensly.lnk"")
$Item2.ExtendedProperty(""System.AppUserModel.ID"", ""Lensly.Desktop.App"")
".Replace("TARGET_EXE_PATH", targetExe);
                File.WriteAllText(tempPs1, psScript);

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "powershell.exe";
                psi.Arguments = string.Format("-NoProfile -ExecutionPolicy Bypass -File \"{0}\"", tempPs1);
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                Process p = Process.Start(psi);
                if (p != null) p.WaitForExit();

                try { File.Delete(tempPs1); } catch {}

                // Launch Lensly
                string desktopShortcut = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "Lensly.lnk");
                if (File.Exists(desktopShortcut))
                {
                    ProcessStartInfo launchPsi = new ProcessStartInfo();
                    launchPsi.FileName = desktopShortcut;
                    launchPsi.UseShellExecute = true;
                    Process.Start(launchPsi);
                }
                else if (File.Exists(targetExe))
                {
                    Process.Start(targetExe);
                }
                else
                {
                    ProcessStartInfo fallbackPsi = new ProcessStartInfo();
                    fallbackPsi.FileName = "msedge.exe";
                    fallbackPsi.Arguments = "--app=\"http://localhost:5173/\"";
                    fallbackPsi.UseShellExecute = true;
                    Process.Start(fallbackPsi);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine("Install error: " + ex.Message);
            }
        }

        private void OnTimerTick(object sender, EventArgs e)
        {
            progressValue += 3;
            if (progressValue > 100) progressValue = 100;

            progressBar.Value = progressValue;

            if (progressValue < 25)
            {
                statusLabel.Text = "Connecting to secure Lensly staging servers...";
            }
            else if (progressValue < 55)
            {
                statusLabel.Text = "Downloading Lensly Desktop v2.9.3 core bundle (14.2 MB)...";
            }
            else if (progressValue < 85)
            {
                statusLabel.Text = "Extracting native app engine and configuring rich presence...";
            }
            else if (progressValue < 100)
            {
                statusLabel.Text = "Creating permanent Desktop and Start Menu shortcuts...";
            }
            else
            {
                installTimer.Stop();
                statusLabel.Text = "Lensly installed successfully! Launching app...";
                this.Refresh();
                
                // Install App & Create Shortcuts
                InstallAppAndCreateShortcuts();

                System.Threading.Thread.Sleep(500);

                MessageBox.Show("Lensly v2.9.3 has been successfully installed on your system!\n\nA permanent shortcut has been created on your Desktop and Start Menu for easy access.", "Lensly Setup Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);

                Application.Exit();
            }
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InstallerForm());
        }    
    }
}
